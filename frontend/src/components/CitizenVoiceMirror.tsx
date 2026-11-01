import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  Square,
  Send,
  MapPin,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Volume2,
  VolumeX,
  Clock,
  FileCheck,
} from 'lucide-react';
import type { TelemetryEvent, CSCLocation, WeatherData } from '../types';
import { submitTextQuery, submitVoiceUpload, resolveAudioUrl } from '../services/api';

// Format seconds into M:SS
const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export interface ChatTurn {
  id: string;
  timestamp: string;
  userQuery: {
    text: string;
    englishText?: string;
    isVoice: boolean;
    audioUrl?: string;
    fallbackUrl?: string;
    duration?: number;
  };
  aiResponse?: {
    schemeName: string;
    isEligible: boolean;
    speechText: string;
    entitlementSummary: string;
    documents: string[];
    audioUrl?: string;
    cscCenter?: CSCLocation;
    weatherData?: WeatherData;
    latencyMs?: number;
  };
  rawEvent?: TelemetryEvent;
  isLoading?: boolean;
}

// Convert a backend TelemetryEvent into a UI ChatTurn
const eventToChatTurn = (
  event: TelemetryEvent,
  localAudioUrl?: string,
  localAudioDuration?: number
): ChatTurn => {
  const isVoice = Boolean(
    localAudioUrl ||
      (event.incoming_audio_url && event.incoming_audio_url.trim() !== '')
  );

  return {
    id: event.session_id || `turn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: event.timestamp
      ? new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    userQuery: {
      text: event.native_transcript || event.english_translation || 'Citizen Query',
      englishText:
        event.english_translation && event.english_translation !== event.native_transcript
          ? event.english_translation
          : undefined,
      isVoice,
      audioUrl:
        localAudioUrl ||
        (event.incoming_audio_url ? resolveAudioUrl(event.incoming_audio_url) : undefined),
      fallbackUrl:
        event.incoming_audio_url ? resolveAudioUrl(event.incoming_audio_url) : undefined,
      duration: localAudioDuration,
    },
    aiResponse: {
      schemeName: event.verdict?.scheme_name || 'Government Welfare Scheme',
      isEligible: event.verdict?.is_eligible ?? true,
      speechText:
        event.verdict?.english_voice_script ||
        event.verdict?.local_language_script ||
        '',
      entitlementSummary: event.verdict?.entitlement_summary || '',
      documents: event.verdict?.exact_three_documents || [],
      audioUrl: event.outbound_audio_url
        ? resolveAudioUrl(event.outbound_audio_url)
        : undefined,
      cscCenter: event.csc_center,
      weatherData: event.weather_data,
      latencyMs: event.total_latency_ms,
    },
    rawEvent: event,
    isLoading: false,
  };
};

// --- Reusable, 60FPS Synchronized Audio Player Component ---
interface VoicePlayerBarProps {
  audioUrl: string;
  fallbackUrl?: string;
  label: string;
  theme?: 'indigo' | 'blue';
  allowSpeed?: boolean;
  initialDuration?: number;
}

const VoicePlayerBar: React.FC<VoicePlayerBarProps> = ({
  audioUrl,
  fallbackUrl,
  label,
  theme = 'blue',
  allowSpeed = false,
  initialDuration = 0,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [duration, setDuration] = useState<number>(initialDuration);
  const [currentSrc, setCurrentSrc] = useState<string>(resolveAudioUrl(audioUrl));

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLSpanElement | null>(null);
  const timeRef = useRef<HTMLSpanElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const playerIdRef = useRef<string>(`player_${Math.random().toString(36).substring(2, 9)}`);

  // Update source if prop changes
  useEffect(() => {
    const src = resolveAudioUrl(audioUrl);
    setCurrentSrc(src);
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [audioUrl]);

  // Ensure only one audio plays at any time across the chat
  useEffect(() => {
    const handleGlobalPause = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail !== playerIdRef.current) {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
        }
      }
    };
    window.addEventListener('policysetu:pause_other_audio', handleGlobalPause);
    return () => {
      window.removeEventListener('policysetu:pause_other_audio', handleGlobalPause);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const getEffectiveDuration = useCallback(() => {
    const audio = audioRef.current;
    if (audio && isFinite(audio.duration) && audio.duration > 0) {
      return audio.duration;
    }
    return duration > 0 ? duration : initialDuration || 0;
  }, [duration, initialDuration]);

  const updateDisplay = useCallback((current: number, dur: number) => {
    if (progressBarRef.current && dur > 0) {
      const pct = Math.min((current / dur) * 100, 100);
      progressBarRef.current.style.width = `${pct}%`;
    }
    if (timeRef.current) {
      if (dur > 0) {
        timeRef.current.textContent = `${formatTime(current)} / ${formatTime(dur)}`;
      } else {
        timeRef.current.textContent = formatTime(current);
      }
    }
  }, []);

  const runSyncLoop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = getEffectiveDuration();
    const current = Math.min(audio.currentTime, dur > 0 ? dur : audio.currentTime);
    updateDisplay(current, dur);

    if (!audio.paused && !audio.ended) {
      animFrameRef.current = requestAnimationFrame(runSyncLoop);
    }
  }, [getEffectiveDuration, updateDisplay]);

  const handlePlay = () => {
    window.dispatchEvent(
      new CustomEvent('policysetu:pause_other_audio', { detail: playerIdRef.current })
    );
    setIsPlaying(true);
    if (statusRef.current) statusRef.current.textContent = 'Playing...';
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(runSyncLoop);
  };

  const handlePause = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsPlaying(false);
    if (statusRef.current) statusRef.current.textContent = 'Paused';
    const audio = audioRef.current;
    if (audio) {
      const dur = getEffectiveDuration();
      updateDisplay(audio.currentTime, dur);
    }
  };

  const handleEnded = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsPlaying(false);
    if (statusRef.current) statusRef.current.textContent = 'Finished';
    const dur = getEffectiveDuration();
    if (progressBarRef.current) progressBarRef.current.style.width = '100%';
    if (timeRef.current && dur > 0) {
      timeRef.current.textContent = `${formatTime(dur)} / ${formatTime(dur)}`;
    }
  };

  const handleMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = audio.duration;
    if (isFinite(dur) && dur > 0) {
      setDuration(dur);
      updateDisplay(audio.currentTime, dur);
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = getEffectiveDuration();
    updateDisplay(audio.currentTime, dur);
  };

  const handleAudioError = () => {
    if (fallbackUrl) {
      const resolvedFallback = resolveAudioUrl(fallbackUrl);
      if (currentSrc !== resolvedFallback) {
        console.warn('Primary audio failed, switching to fallback:', resolvedFallback);
        setCurrentSrc(resolvedFallback);
        setTimeout(() => {
          audioRef.current?.load();
        }, 50);
      }
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused && !audio.ended) {
      audio.pause();
    } else {
      const dur = getEffectiveDuration();
      if (audio.ended || (dur > 0 && audio.currentTime >= dur - 0.15)) {
        audio.currentTime = 0;
      }
      audio.playbackRate = speed;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio playback error:', err);
          if (fallbackUrl && currentSrc !== resolveAudioUrl(fallbackUrl)) {
            const resolvedFallback = resolveAudioUrl(fallbackUrl);
            setCurrentSrc(resolvedFallback);
            setTimeout(() => {
              audioRef.current?.play().catch(console.warn);
            }, 100);
          }
        });
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const track = trackRef.current;
    if (!audio || !track) return;
    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const dur = getEffectiveDuration();
    if (dur > 0) {
      const targetTime = ratio * dur;
      audio.currentTime = targetTime;
      updateDisplay(targetTime, dur);
    }
  };

  const cycleSpeed = () => {
    const nextSpeed = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const isIndigo = theme === 'indigo';

  return (
    <div
      className={`rounded-xl p-2.5 flex items-center gap-3 border shadow-2xs ${
        isIndigo
          ? 'bg-white/90 border-indigo-200/80 mb-2.5'
          : 'bg-slate-50 border-slate-200/90 mb-3'
      }`}
    >
      <audio
        ref={audioRef}
        src={currentSrc}
        preload="auto"
        onLoadedMetadata={handleMetadata}
        onDurationChange={handleMetadata}
        onCanPlay={handleMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleAudioError}
        className="hidden"
      />

      <button
        type="button"
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xs transition-transform active:scale-90 cursor-pointer ${
          isIndigo
            ? 'bg-indigo-900 hover:bg-indigo-800'
            : 'bg-blue-900 hover:bg-blue-800 hover:scale-105'
        }`}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div
          ref={trackRef}
          onClick={handleSeek}
          className={`h-2 w-full rounded-full overflow-hidden cursor-pointer relative group ${
            isIndigo ? 'bg-indigo-100' : 'bg-slate-200'
          }`}
          title="Click to seek"
        >
          <div
            ref={progressBarRef}
            className={`h-full rounded-full will-change-[width] transition-[width] duration-75 ${
              isIndigo
                ? 'bg-indigo-900 group-hover:bg-indigo-700'
                : 'bg-blue-900 group-hover:bg-blue-700'
            }`}
            style={{ width: '0%' }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
          <span ref={statusRef}>{label}</span>
          <div className="flex items-center gap-2">
            <span
              ref={timeRef}
              className={`font-semibold ${isIndigo ? 'text-indigo-900' : 'text-blue-900'}`}
            >
              {duration > 0 || initialDuration > 0
                ? `0:00 / ${formatTime(duration || initialDuration)}`
                : '0:00'}
            </span>
            {allowSpeed && (
              <button
                type="button"
                onClick={cycleSpeed}
                className="hover:text-blue-900 font-bold px-1.5 py-0.5 rounded bg-slate-200/70 hover:bg-slate-300 transition-colors"
                title="Change playback speed"
              >
                {speed}x
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Citizen Voice Mirror Component ---
interface CitizenVoiceMirrorProps {
  currentEvent: TelemetryEvent | null;
  onQueryExecuted: (event: TelemetryEvent) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
  onResetSession: () => void;
  onViewTelemetry?: () => void;
}

export const CitizenVoiceMirror: React.FC<CitizenVoiceMirrorProps> = ({
  currentEvent,
  onQueryExecuted,
  isLoading,
  setIsLoading,
  onResetSession,
  onViewTelemetry,
}) => {
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [inputText, setInputText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  const [coords, setCoords] = useState<{ lat?: number; lon?: number }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gpsDetecting, setGpsDetecting] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const recordingSecondsRef = useRef<number>(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Initialize history if empty and currentEvent exists from server
  useEffect(() => {
    if (currentEvent && history.length === 0) {
      setHistory([eventToChatTurn(currentEvent)]);
    }
  }, [currentEvent]);

  // Auto-scroll chat to bottom smoothly when history updates or during loading
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [history.length, isLoading]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Geolocation trigger
  const handleGetLocation = () => {
    setGpsDetecting(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
          setGpsDetecting(false);
        },
        () => {
          setGpsDetecting(false);
        },
        { timeout: 6000 }
      );
    } else {
      setGpsDetecting(false);
    }
  };

  // Mic Recording
  const startRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const actualMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        const localBlobUrl = URL.createObjectURL(audioBlob);
        const recordedDur = recordingSecondsRef.current || 1;

        const tempId = `turn_${Date.now()}`;
        const pendingTurn: ChatTurn = {
          id: tempId,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          userQuery: {
            text: 'Processing regional voice message...',
            isVoice: true, // Voice note -> Shows real voice player bar!
            audioUrl: localBlobUrl,
            duration: recordedDur,
          },
          isLoading: true,
        };

        setHistory((prev) => [...prev, pendingTurn]);
        setIsLoading(true);

        try {
          const result = await submitVoiceUpload(audioBlob);
          const completedTurn = eventToChatTurn(result, localBlobUrl, recordedDur);
          setHistory((prev) =>
            prev.map((t) => (t.id === tempId ? completedTurn : t))
          );
          onQueryExecuted(result);
        } catch (err: any) {
          setErrorMessage(err.message || 'Voice upload failed');
          setHistory((prev) => prev.filter((t) => t.id !== tempId));
        } finally {
          setIsLoading(false);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      timerIntervalRef.current = window.setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
      }, 1000);
    } catch {
      setErrorMessage('Microphone access denied or unsupported.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  // Submit Text Query
  const handleSendText = async (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;

    const tempId = `turn_${Date.now()}`;
    const pendingTurn: ChatTurn = {
      id: tempId,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      userQuery: {
        text: query.trim(),
        isVoice: false, // Pure text query -> NO voice bar!
      },
      isLoading: true,
    };

    setHistory((prev) => [...prev, pendingTurn]);
    if (!textToSend) setInputText('');
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await submitTextQuery(
        query.trim(),
        'web_citizen',
        coords.lat,
        coords.lon
      );
      const completedTurn = eventToChatTurn(result);
      if (!completedTurn.userQuery.text) {
        completedTurn.userQuery.text = query.trim();
      }
      completedTurn.userQuery.isVoice = false;

      setHistory((prev) =>
        prev.map((t) => (t.id === tempId ? completedTurn : t))
      );
      onQueryExecuted(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Execution error');
      setHistory((prev) => prev.filter((t) => t.id !== tempId));
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Session
  const handleReset = () => {
    setInputText('');
    setErrorMessage(null);
    setHistory([]);
    window.dispatchEvent(
      new CustomEvent('policysetu:pause_other_audio', { detail: 'all' })
    );
    onResetSession();
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl shadow-elevated overflow-hidden transition-all duration-300 hover:shadow-ambient">
      {/* WhatsApp-Style Fixed Chat Header */}
      <div className="shrink-0 bg-sunrise-saffron border-b-2 border-orange-500/90 px-3 py-2 sm:px-5 sm:py-3 flex items-center justify-between gap-2 sm:gap-3 shadow-xs z-10">
        {/* Left: Assistant Identity */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white border border-orange-300 text-orange-600 flex items-center justify-center text-base sm:text-lg shadow-xs transition-transform hover:scale-105 shrink-0">
            🎙️
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight truncate">
                Citizen Voice Assistant
              </h2>
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-white text-emerald-800 border border-emerald-300 shadow-2xs shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Ready
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] font-semibold text-orange-950/80 truncate">
              Multilingual Scheme Guidance • Sarvam Saaras AI
            </p>
          </div>
        </div>

        {/* Right: Voice Pill & Reset */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all shadow-2xs ${
              voiceEnabled
                ? 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50'
                : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
            }`}
            title="Toggle Voice Output"
          >
            {voiceEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="hidden sm:inline">
                  Voice: <strong className="text-emerald-700">ON</strong>
                </span>
                <span className="sm:hidden">
                  <strong className="text-emerald-700">ON</strong>
                </span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="hidden sm:inline">
                  Voice: <strong className="text-slate-600">OFF</strong>
                </span>
                <span className="sm:hidden">
                  <strong className="text-slate-600">OFF</strong>
                </span>
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg bg-white/90 hover:bg-orange-100 border border-orange-300 text-orange-950 text-[11px] sm:text-xs font-bold shadow-2xs transition-all hover:border-orange-400 active:scale-95 cursor-pointer shrink-0"
            title="Reset Session"
          >
            <RotateCcw className="w-3 h-3 text-orange-700" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* The Scrollable Chat Body With Preserved History */}
      <div
        ref={chatScrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 bg-chat-pattern flex flex-col gap-4"
      >
        {/* Session Time Badge */}
        <div className="self-center inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-slate-200 shadow-2xs text-[10px] font-semibold text-slate-500">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>Today • Live Vernacular Session</span>
        </div>

        {/* Empty State */}
        {history.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 my-auto">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-2xl mb-3 shadow-xs">
              🌾
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              PolicySetu Voice & Scheme Guidance
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mb-4">
              Ask any government scheme query by voice or text in Gujarati, Marathi, Telugu, Hindi, or English.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              <button
                onClick={() =>
                  handleSendText('હું જામનગર માં 50 વીઘા જમીન ધરાવું છું, શું હું સહાય મેળવી શકું?')
                }
                className="text-[11px] bg-white border border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 rounded-lg px-2.5 py-1.5 text-slate-700 text-left transition-all shadow-2xs cursor-pointer"
              >
                🌾 Gujarat MMKSY Query (Gujarati)
              </button>
              <button
                onClick={() =>
                  handleSendText('मी जालना जिल्ह्यात 2 एकर कोरडवाहू शेतकरी आहे, दुष्काळ अनुदान मिळेल का?')
                }
                className="text-[11px] bg-white border border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 rounded-lg px-2.5 py-1.5 text-slate-700 text-left transition-all shadow-2xs cursor-pointer"
              >
                🌧️ Maharashtra Drought Query (Marathi)
              </button>
            </div>
          </div>
        )}

        {/* Render Conversation Turns */}
        {history.map((turn) => (
          <React.Fragment key={turn.id}>
            {/* Citizen Message Bubble (Self-End) */}
            <div className="animate-slide-up self-end max-w-[92%] sm:max-w-[85%] bg-indigo-50/90 border border-indigo-200/90 rounded-2xl rounded-tr-xs p-3.5 sm:p-4 shadow-sm transition-all hover:shadow-md">
              {/* Voice Player Bar (ONLY when user sent voice) */}
              {turn.userQuery.isVoice && turn.userQuery.audioUrl && (
                <VoicePlayerBar
                  audioUrl={turn.userQuery.audioUrl}
                  fallbackUrl={turn.userQuery.fallbackUrl}
                  label="Citizen Voice Note"
                  theme="indigo"
                  initialDuration={turn.userQuery.duration}
                />
              )}

              {/* Message / Transcript Box */}
              <div className="bg-white/95 rounded-xl p-3 border border-indigo-100 shadow-inner">
                <div className="text-[9px] font-bold text-indigo-900 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>
                    {turn.userQuery.isVoice ? 'Citizen Transcript' : 'Citizen Query'}
                  </span>
                  <span className="text-[10px]">
                    {turn.userQuery.isVoice ? '🎙️' : '💬'}
                  </span>
                </div>
                <p className="font-indic text-sm font-semibold text-slate-900 leading-snug">
                  &ldquo;{turn.userQuery.text}&rdquo;
                </p>
                {turn.userQuery.englishText && (
                  <p className="text-xs text-slate-500 italic mt-1.5 pt-1.5 border-t border-dashed border-slate-200">
                    &ldquo;{turn.userQuery.englishText}&rdquo;
                  </p>
                )}
              </div>
              <div className="flex justify-end mt-1 text-[10px] font-mono text-indigo-950/60">
                {turn.timestamp}
              </div>
            </div>

            {/* AI Adjudicating Pending State */}
            {turn.isLoading && (
              <div className="animate-slide-up self-start max-w-[94%] sm:max-w-[88%] bg-white/95 border border-slate-200 rounded-2xl rounded-tl-xs p-4 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 shrink-0">
                  <Sparkles className="w-4 h-4 animate-spin text-blue-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    PolicySetu AI Adjudicating...
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Searching Qdrant mandate vectors, Open-Meteo deficit triggers & nearest CSC location
                  </div>
                </div>
              </div>
            )}

            {/* AI Response Bubble (Self-Start) */}
            {turn.aiResponse && (
              <div className="flex flex-col gap-3 self-start max-w-[94%] sm:max-w-[88%]">
                {/* AI Speech Bubble */}
                <div className="animate-slide-up bg-white/95 border border-slate-200 rounded-2xl rounded-tl-xs p-4 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
                    <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-800" />
                      <span>Policy-Setu AI Voice Response</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Sarvam Indic TTS
                    </span>
                  </div>

                  {/* AI Audio Player Bar (ONLY when voice is enabled and audio exists) */}
                  {voiceEnabled && turn.aiResponse.audioUrl && (
                    <VoicePlayerBar
                      audioUrl={turn.aiResponse.audioUrl}
                      label="Voice Response"
                      theme="blue"
                      allowSpeed={true}
                    />
                  )}

                  {/* Speech Text */}
                  <p className="font-indic text-xs sm:text-[13px] text-slate-800 leading-relaxed">
                    {turn.aiResponse.speechText}
                  </p>
                  <div className="flex justify-end mt-1.5 text-[10px] font-mono text-slate-400">
                    {turn.timestamp}
                  </div>
                </div>

                {/* Vernacular Checklist Bubble */}
                {turn.aiResponse.schemeName && (
                  <div
                    onClick={() => {
                      if (turn.rawEvent) onQueryExecuted(turn.rawEvent);
                      if (onViewTelemetry) onViewTelemetry();
                    }}
                    className="animate-slide-up bg-white/95 border border-emerald-300 rounded-2xl rounded-tl-xs p-3.5 sm:p-4 shadow-sm transition-all hover:shadow-md cursor-pointer group"
                    title="Click to view CSC map and telemetry for this scheme"
                  >
                    {/* Scheme Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs sm:text-sm font-extrabold text-emerald-950 group-hover:text-emerald-700 transition-colors">
                        {turn.aiResponse.schemeName}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase shrink-0 ${
                          turn.aiResponse.isEligible
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {turn.aiResponse.isEligible ? 'ELIGIBLE' : 'PENDING'}
                      </span>
                    </div>

                    {/* Entitlement Payout Box */}
                    <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-3 mb-3">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-900 block">
                          Estimated Entitlement
                        </span>
                        <span className="text-xs sm:text-sm font-mono font-extrabold text-emerald-800">
                          {turn.aiResponse.entitlementSummary}
                        </span>
                      </div>
                      <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
                    </div>

                    {/* 3 Required Documents */}
                    {turn.aiResponse.documents.length > 0 && (
                      <div>
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                          <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
                          <span>3 Documents Required:</span>
                        </span>
                        <div className="space-y-1.5">
                          {turn.aiResponse.documents.map((doc, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-100"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="font-indic font-medium">{doc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mobile Quick Link to CSC Map & Telemetry */}
                    {onViewTelemetry && turn.aiResponse.cscCenter && (
                      <div className="lg:hidden mt-3 pt-2.5 border-t border-emerald-200/60 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-blue-700" />
                          <span>Nearest CSC Available</span>
                        </span>
                        <span className="text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 group-hover:bg-blue-100 transition-colors">
                          View Map &amp; Telemetry &rarr;
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {errorMessage}
          </div>
        )}
      </div>

      {/* WhatsApp-Style Fixed Bottom Input Bar */}
      <div className="shrink-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-2 sm:p-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center gap-1.5 sm:gap-2.5 z-20">
        {/* Geolocation Button */}
        <button
          onClick={handleGetLocation}
          disabled={gpsDetecting}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 flex items-center justify-center text-sm shadow-xs transition-all active:scale-95 disabled:opacity-60 shrink-0 cursor-pointer"
          title={`Detect Location (${coords.lat?.toFixed(2)}, ${coords.lon?.toFixed(2)})`}
        >
          {gpsDetecting ? (
            <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <MapPin className="w-4 h-4 text-blue-800" />
          )}
        </button>

        {/* Message Input Box */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendText();
          }}
          placeholder="Type or speak query in Marathi, Hindi, Telugu, Gujarati..."
          className="flex-1 min-w-0 bg-slate-50 focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 outline-none transition-all shadow-inner focus:ring-2 focus:ring-blue-100"
        />

        {/* Recording Mic Button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-xs transition-all active:scale-95 shrink-0 cursor-pointer ${
            isRecording
              ? 'bg-rose-600 hover:bg-rose-700 animate-mic-pulse'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
          title={
            isRecording
              ? `Recording (${recordingSeconds}s)... Click to Stop`
              : 'Click to Speak'
          }
        >
          {isRecording ? (
            <Square className="w-4 h-4 fill-current" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>

        {/* Send Button */}
        <button
          onClick={() => handleSendText()}
          disabled={isLoading || !inputText.trim()}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:bg-slate-300 text-white flex items-center justify-center text-sm shadow-xs transition-all active:scale-95 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          title="Send Query"
        >
          {isLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4 ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
};

export default CitizenVoiceMirror;
