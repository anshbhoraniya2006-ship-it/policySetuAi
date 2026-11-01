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
  FileCheck
} from 'lucide-react';
import type { TelemetryEvent } from '../types';
import { submitTextQuery, submitVoiceUpload, resolveAudioUrl } from '../services/api';

interface CitizenVoiceMirrorProps {
  currentEvent: TelemetryEvent | null;
  onQueryExecuted: (event: TelemetryEvent) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
  onResetSession: () => void;
}

export const CitizenVoiceMirror: React.FC<CitizenVoiceMirrorProps> = ({
  currentEvent,
  onQueryExecuted,
  isLoading,
  setIsLoading,
  onResetSession,
}) => {
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [inputText, setInputText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  // Playback state toggles (progress is driven by requestAnimationFrame directly on DOM refs)
  const [isPlayingOutbound, setIsPlayingOutbound] = useState<boolean>(false);
  const [isPlayingUserAudio, setIsPlayingUserAudio] = useState<boolean>(false);
  const [audioSpeed, setAudioSpeed] = useState<number>(1);
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);

  const [coords, setCoords] = useState<{ lat?: number; lon?: number }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gpsDetecting, setGpsDetecting] = useState<boolean>(false);

  // High-performance DOM Refs for 60fps animations
  const aiProgressBarRef = useRef<HTMLDivElement | null>(null);
  const aiProgressStatusRef = useRef<HTMLSpanElement | null>(null);
  const aiAnimationIdRef = useRef<number | null>(null);

  const userProgressBarRef = useRef<HTMLDivElement | null>(null);
  const userProgressStatusRef = useRef<HTMLSpanElement | null>(null);
  const userAnimationIdRef = useRef<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const outboundAudioRef = useRef<HTMLAudioElement | null>(null);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat to bottom on new event
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [currentEvent, isLoading]);

  // Clean up animation frames & audio on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (aiAnimationIdRef.current) cancelAnimationFrame(aiAnimationIdRef.current);
      if (userAnimationIdRef.current) cancelAnimationFrame(userAnimationIdRef.current);
      if (outboundAudioRef.current) {
        outboundAudioRef.current.pause();
        outboundAudioRef.current.currentTime = 0;
      }
      if (userAudioRef.current) {
        userAudioRef.current.pause();
        userAudioRef.current.currentTime = 0;
      }
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
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const localBlobUrl = URL.createObjectURL(audioBlob);
        setUserAudioUrl(localBlobUrl);
        setIsLoading(true);
        try {
          const result = await submitVoiceUpload(audioBlob);
          onQueryExecuted(result);
        } catch (err: any) {
          setErrorMessage(err.message || 'Voice upload failed');
        } finally {
          setIsLoading(false);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setErrorMessage('Microphone access denied or unsupported.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  // Submit Query
  const handleSendText = async (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;

    setErrorMessage(null);
    setIsLoading(true);
    try {
      const result = await submitTextQuery(
        query.trim(),
        'whatsapp:+919510010478',
        coords.lat,
        coords.lon
      );
      onQueryExecuted(result);
      if (!textToSend) setInputText('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Execution error');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Session
  const handleReset = () => {
    setInputText('');
    setErrorMessage(null);
    setUserAudioUrl(null);
    if (aiAnimationIdRef.current) cancelAnimationFrame(aiAnimationIdRef.current);
    if (userAnimationIdRef.current) cancelAnimationFrame(userAnimationIdRef.current);
    if (aiProgressBarRef.current) aiProgressBarRef.current.style.width = '0%';
    if (userProgressBarRef.current) userProgressBarRef.current.style.width = '0%';
    if (outboundAudioRef.current) {
      outboundAudioRef.current.pause();
      outboundAudioRef.current.currentTime = 0;
    }
    if (userAudioRef.current) {
      userAudioRef.current.pause();
      userAudioRef.current.currentTime = 0;
    }
    setIsPlayingOutbound(false);
    setIsPlayingUserAudio(false);
    onResetSession();
  };

  // 60FPS Fluid User Audio Playback Animation (via requestAnimationFrame)
  const stopUserAudioAnimation = useCallback(() => {
    if (userAnimationIdRef.current) {
      cancelAnimationFrame(userAnimationIdRef.current);
      userAnimationIdRef.current = null;
    }
    if (userAudioRef.current) userAudioRef.current.pause();
    setIsPlayingUserAudio(false);
  }, []);

  const startUserAudioAnimation = useCallback(() => {
    if (userAnimationIdRef.current) cancelAnimationFrame(userAnimationIdRef.current);
    setIsPlayingUserAudio(true);
    if (userProgressStatusRef.current) {
      userProgressStatusRef.current.textContent = 'Playing Citizen Audio...';
    }

    const duration = 4000;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);

      if (userProgressBarRef.current) {
        userProgressBarRef.current.style.width = `${progress}%`;
      }

      if (progress < 100) {
        userAnimationIdRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlayingUserAudio(false);
        userAnimationIdRef.current = null;
        if (userProgressStatusRef.current) {
          userProgressStatusRef.current.textContent = 'Finished';
        }
      }
    };

    userAnimationIdRef.current = requestAnimationFrame(animate);
  }, []);

  const togglePlayUserAudio = () => {
    if (isPlayingUserAudio) {
      stopUserAudioAnimation();
      if (userProgressStatusRef.current) {
        userProgressStatusRef.current.textContent = 'Paused';
      }
      return;
    }

    const effectiveAudioUrl =
      userAudioUrl ||
      (currentEvent?.incoming_audio_url
        ? resolveAudioUrl(currentEvent.incoming_audio_url)
        : null);

    if (userAudioRef.current && effectiveAudioUrl) {
      userAudioRef.current.pause();
      userAudioRef.current.currentTime = 0;
      userAudioRef.current
        .play()
        .then(() => startUserAudioAnimation())
        .catch(() => startUserAudioAnimation());
      return;
    }

    startUserAudioAnimation();
  };

  // 60FPS Fluid AI Outbound Playback Animation (via requestAnimationFrame)
  const stopAIAnimation = useCallback(() => {
    if (aiAnimationIdRef.current) {
      cancelAnimationFrame(aiAnimationIdRef.current);
      aiAnimationIdRef.current = null;
    }
    if (outboundAudioRef.current) {
      outboundAudioRef.current.pause();
    }
    setIsPlayingOutbound(false);
  }, []);

  const startAIAnimation = useCallback((durationMs: number) => {
    if (aiAnimationIdRef.current) cancelAnimationFrame(aiAnimationIdRef.current);
    setIsPlayingOutbound(true);
    if (aiProgressStatusRef.current) {
      aiProgressStatusRef.current.textContent = 'Playing Vernacular Audio...';
    }

    const effectiveDuration = durationMs / audioSpeed;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min((elapsed / effectiveDuration) * 100, 100);

      if (aiProgressBarRef.current) {
        aiProgressBarRef.current.style.width = `${progress}%`;
      }

      if (progress < 100) {
        aiAnimationIdRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlayingOutbound(false);
        aiAnimationIdRef.current = null;
        if (aiProgressStatusRef.current) {
          aiProgressStatusRef.current.textContent = 'Finished';
        }
      }
    };

    aiAnimationIdRef.current = requestAnimationFrame(animate);
  }, [audioSpeed]);

  const togglePlayOutbound = () => {
    if (!voiceEnabled) return;

    if (isPlayingOutbound) {
      stopAIAnimation();
      if (aiProgressStatusRef.current) {
        aiProgressStatusRef.current.textContent = 'Paused';
      }
      return;
    }

    // Always pause and reset any existing audio before starting new playback
    if (outboundAudioRef.current) {
      outboundAudioRef.current.pause();
      outboundAudioRef.current.currentTime = 0;
      outboundAudioRef.current.playbackRate = audioSpeed;
      outboundAudioRef.current
        .play()
        .then(() => startAIAnimation(6000))
        .catch(() => startAIAnimation(6000));
      return;
    }

    // No audio element available — just run the animation
    startAIAnimation(6000);
  };

  const cycleSpeed = () => {
    const nextSpeed = audioSpeed === 1 ? 1.25 : audioSpeed === 1.25 ? 1.5 : 1;
    setAudioSpeed(nextSpeed);
    if (outboundAudioRef.current) {
      outboundAudioRef.current.playbackRate = nextSpeed;
    }
  };

  const nativeTranscript =
    currentEvent?.native_transcript || '';
  const englishTranslation =
    currentEvent?.english_translation || '';
  const speechText =
    currentEvent?.verdict?.english_voice_script || '';
  const schemeTitle =
    currentEvent?.verdict?.scheme_name || '';
  const isEligible = currentEvent?.verdict?.is_eligible ?? true;
  const entitlement =
    currentEvent?.verdict?.entitlement_summary || '';
  const documents =
    currentEvent?.verdict?.exact_three_documents &&
      currentEvent.verdict.exact_three_documents.length > 0
      ? currentEvent.verdict.exact_three_documents
      : [];

  return (
    <div className="h-full flex flex-col min-h-0 bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl shadow-elevated overflow-hidden transition-all duration-300 hover:shadow-ambient">
      {/* Hidden Audio Elements for streaming */}
      {currentEvent?.outbound_audio_url && (
        <audio
          ref={outboundAudioRef}
          src={resolveAudioUrl(currentEvent.outbound_audio_url)}
          onEnded={() => {
            setIsPlayingOutbound(false);
            if (aiProgressBarRef.current) aiProgressBarRef.current.style.width = '100%';
            if (aiProgressStatusRef.current) aiProgressStatusRef.current.textContent = 'Finished';
          }}
          className="hidden"
        />
      )}
      {(userAudioUrl || currentEvent?.incoming_audio_url) && (
        <audio
          ref={userAudioRef}
          src={
            userAudioUrl ||
            (currentEvent?.incoming_audio_url
              ? resolveAudioUrl(currentEvent.incoming_audio_url)
              : undefined)
          }
          onEnded={() => {
            setIsPlayingUserAudio(false);
            if (userProgressBarRef.current) userProgressBarRef.current.style.width = '100%';
            if (userProgressStatusRef.current) userProgressStatusRef.current.textContent = 'Finished';
          }}
          className="hidden"
        />
      )}

      {/* WhatsApp-Style Fixed Chat Header (Cleaned: NO language dropdown or badge) */}
      <div className="shrink-0 bg-sunrise-saffron border-b-2 border-orange-500/90 px-4 py-3 sm:px-5 flex items-center justify-between gap-3 shadow-xs z-10">
        {/* Left: Assistant Identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-orange-300 text-orange-600 flex items-center justify-center text-lg shadow-xs transition-transform hover:scale-105">
            🎙️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Citizen Voice Assistant
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-emerald-800 border border-emerald-300 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Ready
              </span>
            </div>
            <p className="text-[11px] font-semibold text-orange-950/80">
              Multilingual Scheme Guidance • Sarvam Saaras AI
            </p>
          </div>
        </div>

        {/* Right: Voice Pill & Reset Only */}
        <div className="flex items-center gap-2">
          {/* Voice Mode Toggle Pill */}
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs ${voiceEnabled
                ? 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50'
                : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
              }`}
            title="Toggle Voice Output"
          >
            {voiceEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Voice: <strong className="text-emerald-700">ON</strong></span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                <span>Voice: <strong className="text-slate-600">OFF</strong></span>
              </>
            )}
          </button>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/90 hover:bg-orange-100 border border-orange-300 text-orange-950 text-xs font-bold shadow-2xs transition-all hover:border-orange-400 active:scale-95"
            title="Reset Session"
          >
            <RotateCcw className="w-3 h-3 text-orange-700" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* The ONLY Scrollable Chat Body */}
      <div
        ref={chatScrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 bg-chat-pattern flex flex-col gap-4"
      >
        {/* Session Time Badge */}
        <div className="self-center inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-slate-200 shadow-2xs text-[10px] font-semibold text-slate-500">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>Today • Live Vernacular Session</span>
        </div>

        {/* Citizen Voice Note (User Bubble with 60FPS Fluid Audio Player) */}
        <div className="animate-slide-up self-end max-w-[92%] sm:max-w-[85%] bg-indigo-50/90 border border-indigo-200/90 rounded-2xl rounded-tr-xs p-3.5 sm:p-4 shadow-sm transition-all hover:shadow-md">
          {/* User Audio Player Bar */}
          <div className="bg-white/90 border border-indigo-200/80 rounded-xl p-2.5 flex items-center gap-3 mb-2.5 shadow-2xs">
            <button
              onClick={togglePlayUserAudio}
              className="w-8 h-8 rounded-full bg-indigo-900 hover:bg-indigo-800 text-white flex items-center justify-center text-xs shadow-xs transition-transform active:scale-90"
              title={isPlayingUserAudio ? 'Pause User Recording' : 'Play User Recording'}
            >
              {isPlayingUserAudio ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              )}
            </button>

            <div className="flex-1">
              {/* 60FPS Fluid Progress Bar */}
              <div className="h-1.5 w-full bg-indigo-100 rounded-full overflow-hidden">
                <div
                  ref={userProgressBarRef}
                  className="h-full bg-indigo-900 rounded-full will-change-[width]"
                  style={{ width: '0%' }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span ref={userProgressStatusRef}>User Voice Message</span>
                <span className="font-semibold text-indigo-900">0:04</span>
              </div>
            </div>
          </div>

          {/* Transcript Box */}
          <div className="bg-white/95 rounded-xl p-3 border border-indigo-100 shadow-inner">
            <div className="text-[9px] font-bold text-indigo-900 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Citizen Transcript</span>
              <span className="text-[10px]">🎙️</span>
            </div>
            <p className="font-indic text-sm font-semibold text-slate-900 leading-snug">
              &ldquo;{nativeTranscript}&rdquo;
            </p>
            <p className="text-xs text-slate-500 italic mt-1.5 pt-1.5 border-t border-dashed border-slate-200">
              &ldquo;{englishTranslation}&rdquo;
            </p>
          </div>
        </div>

        {/* Outbound AI Voice Response Bubble (60FPS Fluid Audio Player) */}
        <div className="animate-slide-up self-start max-w-[94%] sm:max-w-[88%] bg-white/95 border border-slate-200 rounded-2xl rounded-tl-xs p-4 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
            <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-800" />
              <span>Policy-Setu AI Voice Response</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">Sarvam Indic TTS</span>
          </div>

          {/* AI Audio Player Control Bar */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 flex items-center gap-3 mb-3">
            <button
              onClick={togglePlayOutbound}
              disabled={!voiceEnabled}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xs transition-transform active:scale-90 ${voiceEnabled
                  ? 'bg-blue-900 hover:bg-blue-800 hover:scale-105'
                  : 'bg-slate-400 cursor-not-allowed'
                }`}
              title={isPlayingOutbound ? 'Pause Audio' : 'Play Audio'}
            >
              {isPlayingOutbound ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              )}
            </button>

            <div className="flex-1">
              {/* 60FPS Fluid Progress Bar */}
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  ref={aiProgressBarRef}
                  className="h-full bg-blue-900 rounded-full will-change-[width]"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span ref={aiProgressStatusRef}>Finished</span>
                <button
                  onClick={cycleSpeed}
                  className="hover:text-blue-900 font-bold px-1.5 py-0.5 rounded bg-slate-200/70"
                  title="Change playback speed"
                >
                  {audioSpeed}x
                </button>
              </div>
            </div>
          </div>

          {/* Speech Text */}
          <p className="font-indic text-xs sm:text-[13px] text-slate-800 leading-relaxed">
            {speechText}
          </p>
        </div>

        {/* Vernacular Checklist Bubble */}
        <div className="animate-slide-up self-start max-w-[94%] sm:max-w-[88%] bg-white/95 border border-emerald-300 rounded-2xl rounded-tl-xs p-4 shadow-sm transition-all hover:shadow-md">
          {/* Scheme Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-xs sm:text-sm font-extrabold text-emerald-950">
              {schemeTitle}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase shrink-0 ${isEligible
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
            >
              {isEligible ? 'ELIGIBLE' : 'PENDING'}
            </span>
          </div>

          {/* Entitlement Payout Box */}
          <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-3 mb-3">
            <div>
              <span className="text-[10px] font-bold text-emerald-900 block">
                Estimated Entitlement
              </span>
              <span className="text-xs sm:text-sm font-mono font-extrabold text-emerald-800">
                {entitlement}
              </span>
            </div>
            <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
          </div>

          {/* 3 Required Documents */}
          <div>
            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>3 Documents Required:</span>
            </span>
            <div className="space-y-1.5">
              {documents.map((doc, idx) => (
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
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {errorMessage}
          </div>
        )}
      </div>

      {/* WhatsApp-Style Fixed Bottom Input Bar (Sticky + Safe Area Inset) */}
      <div className="shrink-0 sticky bottom-0 z-20 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2 sm:gap-3">
        {/* Geolocation Button */}
        <button
          onClick={handleGetLocation}
          disabled={gpsDetecting}
          className="w-10 h-10 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 flex items-center justify-center text-sm shadow-xs transition-all active:scale-95 disabled:opacity-60 shrink-0"
          title={`Detect Location (${coords.lat?.toFixed(2)}, ${coords.lon?.toFixed(2)})`}
        >
          {gpsDetecting ? (
            <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
          placeholder="Type or speak query in Marathi, Hindi, Gujarati..."
          className="flex-1 min-w-0 bg-slate-50 focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 outline-none transition-all shadow-inner focus:ring-2 focus:ring-blue-100"
        />

        {/* Recording Mic Button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-xs transition-all active:scale-95 shrink-0 ${isRecording
              ? 'bg-rose-600 hover:bg-rose-700 animate-mic-pulse'
              : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          title={isRecording ? `Recording (${recordingSeconds}s)... Click to Stop` : 'Click to Speak'}
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
          className="w-10 h-10 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:bg-slate-300 text-white flex items-center justify-center text-sm shadow-xs transition-all active:scale-95 disabled:cursor-not-allowed shrink-0"
          title="Send Query"
        >
          {isLoading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4 ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
};

export default CitizenVoiceMirror;
