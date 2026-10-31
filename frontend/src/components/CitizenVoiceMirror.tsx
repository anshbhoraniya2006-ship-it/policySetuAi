import React, { useState, useRef } from 'react';
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
  ExternalLink,
  Radio
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
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPlayingOutbound, setIsPlayingOutbound] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState<number>(1);
  const [coords, setCoords] = useState<{ lat?: number; lon?: number }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const outboundAudioRef = useRef<HTMLAudioElement | null>(null);

  // Quick Demo Presets for Hackathon Judges
  const samplePresets = [
    {
      label: '🌾 Jalna (Marathi)',
      text: 'माझ्याकडे जालन्यात २ एकर जमीन आहे, मला दुष्काळ निधी मिळेल का?',
      district: 'Jalna, Maharashtra'
    },
    {
      label: '🌱 Gujarat MMKSY',
      text: 'મારા પાસે રાજકોટમાં ૪ હેક્ટર જમીન છે, મુખ્યમંત્રી કિસાન સહાય યોજના મળશે?',
      district: 'Rajkot, Gujarat'
    },
    {
      label: '🌿 Beed Soyabean',
      text: 'बीड जिल्ह्यात अतिवृष्टीमुळे सोयाबीन पिकाचे नुकसान झाले आहे, कोणती मदत मिळेल?',
      district: 'Beed, Maharashtra'
    }
  ];

  // Browser Geolocation
  const handleGetLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
        },
        () => {
          setCoords({ lat: 19.9188, lon: 75.8708 }); // Default to Jalna
        }
      );
    }
  };

  // Start Mic Recording
  const startRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
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

  // Stop Mic Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  // Handle Text Submit
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

  // Toggle Outbound Audio Playback
  const togglePlayOutbound = () => {
    if (!outboundAudioRef.current) return;
    if (isPlayingOutbound) {
      outboundAudioRef.current.pause();
      setIsPlayingOutbound(false);
    } else {
      outboundAudioRef.current.playbackRate = audioSpeed;
      outboundAudioRef.current.play();
      setIsPlayingOutbound(true);
    }
  };

  // Speed Toggle
  const toggleAudioSpeed = () => {
    const newSpeed = audioSpeed === 1 ? 1.25 : audioSpeed === 1.25 ? 1.5 : 1;
    setAudioSpeed(newSpeed);
    if (outboundAudioRef.current) {
      outboundAudioRef.current.playbackRate = newSpeed;
    }
  };

  // Mask Phone Number for Display
  const maskedPhone = currentEvent?.phone_number
    ? currentEvent.phone_number.replace(/(\+91)(\d{5})(\d{5})/, '$1 ••••• •$3')
    : '+91 ••••• •10478';

  const languageLabel = currentEvent?.language_code
    ? currentEvent.language_code === 'mr-IN'
      ? 'mr-IN • Marathi'
      : currentEvent.language_code === 'gu-IN'
      ? 'gu-IN • Gujarati'
      : currentEvent.language_code === 'hi-IN'
      ? 'hi-IN • Hindi'
      : `${currentEvent.language_code} • Regional`
    : 'mr-IN • Marathi';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-elevated flex flex-col h-[820px] overflow-hidden">
      {/* WhatsApp Window Header */}
      <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-emerald-400/40">
              🇮🇳
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-slate-900 rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold tracking-wide text-slate-100">
                {maskedPhone}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
                WhatsApp Native
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>{languageLabel}</span>
              <span>•</span>
              <span className="text-emerald-400">Live Webhook Synced</span>
            </p>
          </div>
        </div>

        <button
          onClick={onResetSession}
          title="Reset Active Session"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px]">Reset</span>
        </button>
      </div>

      {/* WhatsApp Chat Stream Container */}
      <div 
        className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#EFEAE2]/30"
        style={{
          backgroundImage: `radial-gradient(#CBD5E1 0.75px, transparent 0.75px)`,
          backgroundSize: '16px 16px',
        }}
      >
        {/* Waiting / Empty Skeleton State */}
        {!currentEvent && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center text-blue-900">
                <Radio className="w-8 h-8 text-blue-800 animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-ping" />
            </div>
            <div className="max-w-xs space-y-1">
              <h4 className="text-sm font-bold text-slate-900">
                Waiting for Live Voice Stream
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Send an audio voice note to Twilio WhatsApp Sandbox, or click any sample prompt below to run live on stage.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-mono text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>FastAPI Port 8000: Listening</span>
            </div>
          </div>
        )}

        {/* Loading Spinner Skeleton */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-slate-600 animate-pulse">
              Executing 6-Stage Indic Speech RAG Pipeline...
            </p>
          </div>
        )}

        {/* Active Query Messages Stream */}
        {currentEvent && (
          <>
            {/* Timestamp Badge */}
            <div className="flex justify-center">
              <span className="px-2.5 py-1 rounded-full bg-white/80 border border-slate-200 text-[10px] font-medium text-slate-500 shadow-sm font-mono">
                {currentEvent.timestamp ? `Today • ${currentEvent.timestamp.slice(11, 16)}` : 'Live WhatsApp Voice Session'}
              </span>
            </div>

            {/* 1. Incoming Citizen Message (User Bubble - Right Aligned) */}
            <div className="flex justify-end">
              <div className="max-w-[85%] bg-[#D9FDD3] text-slate-900 rounded-2xl rounded-tr-sm p-3.5 shadow-sm border border-emerald-200/60 space-y-2.5">
                {/* Voice Note Audio Bar */}
                <div className="flex items-center gap-3 bg-white/70 px-3 py-2 rounded-xl border border-emerald-200/50">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1 h-4">
                      {[40, 75, 55, 90, 60, 30, 80, 50, 95, 45, 65, 35, 70, 85].map((h, i) => (
                        <span
                          key={i}
                          className="w-1 bg-emerald-600 rounded-full"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                      <span>0:04</span>
                      <span>Opus 24kHz</span>
                    </div>
                  </div>
                </div>

                {/* Dual Transcript Card */}
                <div className="space-y-1.5 pt-1">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                      Native Dialect Transcript ({currentEvent.language_code})
                    </span>
                    <p className="text-xs font-indic font-medium text-slate-900 mt-0.5">
                      "{currentEvent.native_transcript}"
                    </p>
                  </div>

                  <div className="border-t border-emerald-200/50 pt-1.5">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                      Normalized English Query
                    </span>
                    <p className="text-xs text-slate-700 italic mt-0.5">
                      "{currentEvent.english_translation}"
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Outbound AI Reply Bubble 1: Playable Localized Voice Note */}
            <div className="flex justify-start">
              <div className="max-w-[88%] bg-white text-slate-900 rounded-2xl rounded-tl-sm p-3.5 shadow-sm border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-blue-900">
                      Policy-Setu AI Voice Response
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-800 font-semibold border border-blue-200">
                    gTTS / Bulbul
                  </span>
                </div>

                {/* Localized Voice Note Player */}
                <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <button
                    onClick={togglePlayOutbound}
                    className="w-9 h-9 rounded-full bg-blue-900 hover:bg-blue-800 text-white flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95"
                  >
                    {isPlayingOutbound ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1">
                    {/* Visualizer Wave */}
                    <div className="flex items-center gap-1 h-5">
                      {[30, 60, 90, 45, 75, 100, 50, 80, 65, 40, 85, 95, 35, 70, 55, 90, 45, 60].map((h, i) => (
                        <span
                          key={i}
                          className={`w-1 rounded-full transition-all duration-200 ${
                            isPlayingOutbound
                              ? 'bg-blue-800 animate-audio-bar'
                              : 'bg-slate-300'
                          }`}
                          style={{
                            height: isPlayingOutbound ? undefined : `${h}%`,
                            animationDelay: `${(i * 0.08).toFixed(2)}s`
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                      <span>Regional Audio Response</span>
                      <button
                        onClick={toggleAudioSpeed}
                        className="px-1 py-0.5 rounded bg-slate-200 hover:bg-slate-300 font-bold text-[9px] text-slate-700"
                      >
                        {audioSpeed}x
                      </button>
                    </div>
                  </div>
                </div>

                {/* Spoken Script Preview */}
                <p className="text-xs font-indic text-slate-800 leading-relaxed bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                  {currentEvent.verdict?.local_language_script || currentEvent.verdict?.english_voice_script}
                </p>

                {/* Hidden Audio Element */}
                {currentEvent.outbound_audio_url && (
                  <audio
                    ref={outboundAudioRef}
                    src={resolveAudioUrl(currentEvent.outbound_audio_url)}
                    onEnded={() => setIsPlayingOutbound(false)}
                    onError={() => setIsPlayingOutbound(false)}
                  />
                )}
              </div>
            </div>

            {/* 3. Outbound AI Reply Bubble 2: Visual 3-Document Checklist & CSC Pin */}
            <div className="flex justify-start">
              <div className="max-w-[88%] bg-white text-slate-900 rounded-2xl rounded-tl-sm p-4 shadow-sm border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-900">
                    {currentEvent.verdict?.scheme_name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    ELIGIBLE
                  </span>
                </div>

                {/* Estimated Entitlement Highlight */}
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-emerald-800 block">
                      अंदाजे भरपाई / Entitlement
                    </span>
                    <span className="text-xs font-bold font-mono text-emerald-950">
                      {currentEvent.verdict?.entitlement_summary}
                    </span>
                  </div>
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                </div>

                {/* Exact 3 Documents Checklist */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-800 block">
                    आवश्यक ३ कागदपत्रे / 3 Required Documents:
                  </span>
                  {currentEvent.verdict?.exact_three_documents?.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-150 text-xs text-slate-800"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="font-medium text-[11px]">{doc}</span>
                    </div>
                  ))}
                </div>

                {/* Nearest CSC Centre */}
                {currentEvent.csc_center && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                      जवळचे सेवा केंद्र / Nearest CSC
                    </span>
                    <div className="flex items-center justify-between mt-1 text-xs">
                      <span className="font-semibold text-slate-900 truncate">
                        {currentEvent.csc_center.center_name}
                      </span>
                      {currentEvent.csc_center.google_maps_url && (
                        <a
                          href={currentEvent.csc_center.google_maps_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 font-semibold ml-2 shrink-0"
                        >
                          <span>Directions</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Preset Chips Bar for Judges on Stage */}
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 overflow-x-auto flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
          Judge Presets:
        </span>
        {samplePresets.map((preset, idx) => (
          <button
            key={idx}
            disabled={isLoading}
            onClick={() => handleSendText(preset.text)}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 text-slate-700 hover:text-blue-900 text-[11px] font-medium shrink-0 transition-colors shadow-2xs disabled:opacity-50"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Bottom Input Action Bar */}
      <div className="p-3 bg-white border-t border-slate-200 space-y-2">
        {errorMessage && (
          <p className="text-[11px] text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-200">
            {errorMessage}
          </p>
        )}

        <div className="flex items-center gap-2">
          {/* Geolocation Button */}
          <button
            onClick={handleGetLocation}
            title={coords.lat ? `GPS: ${coords.lat.toFixed(4)}, ${coords.lon?.toFixed(4)}` : 'Share Browser GPS'}
            className={`p-2 rounded-xl border transition-colors ${
              coords.lat
                ? 'bg-blue-50 text-blue-900 border-blue-300'
                : 'bg-slate-50 text-slate-500 hover:text-slate-800 border-slate-200'
            }`}
          >
            <MapPin className="w-4 h-4" />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            disabled={isLoading || isRecording}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
            placeholder="Type or speak query in Marathi, Hindi, Gujarati..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
          />

          {/* Send Text Button */}
          {inputText.trim() && (
            <button
              onClick={() => handleSendText()}
              disabled={isLoading}
              className="p-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white shadow-sm transition-transform active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          )}

          {/* Browser MediaRecorder Mic Button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading}
            className={`p-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 ${
              isRecording
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-4 h-4 fill-white" />
                <span className="text-[11px] font-mono font-bold">{recordingSeconds}s</span>
              </>
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
