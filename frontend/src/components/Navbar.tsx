import React, { useState } from 'react';
import { 
  Radio, 
  Database, 
  QrCode, 
  Check, 
  Copy, 
  ExternalLink, 
  X,
  Sparkles,
  PhoneCall
} from 'lucide-react';
import type { SystemHealth } from '../types';

interface NavbarProps {
  activeTab: 'console' | 'ingestion';
  setActiveTab: (tab: 'console' | 'ingestion') => void;
  health: SystemHealth | null;
  isLiveConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  health,
  isLiveConnected,
}) => {
  const [showSandboxModal, setShowSandboxModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const sandboxNumber = '+1 (737) 250-8034';
  const rawSandboxNumber = '17372508034';
  const joinPhrase = 'join twilio-trial';
  const whatsappDeepLink = `https://wa.me/${rawSandboxNumber}?text=${encodeURIComponent(joinPhrase)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinPhrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Top Navigation Bar with DPI Tricolor Hairline */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-subtle">
        <div className="dpi-tricolor-hairline" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-900 to-indigo-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20 ring-1 ring-blue-700/30">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  Policy-Setu <span className="text-blue-900 font-extrabold">AI</span>
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  DPI Regional Voice
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Digital Public Infrastructure • Qdrant Hybrid RAG • Indic Speech
              </p>
            </div>
          </div>

          {/* Center: View Switcher Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('console')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'console'
                  ? 'bg-white text-blue-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-blue-800" />
              <span>Voice & RAG Telemetry</span>
            </button>
            <button
              onClick={() => setActiveTab('ingestion')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'ingestion'
                  ? 'bg-white text-blue-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>Live Mandate Ingestion & Qdrant Indexer</span>
            </button>
          </div>

          {/* Right: Live System Health Pills & WhatsApp Action */}
          <div className="flex items-center gap-2.5">
            {/* Qdrant Status Pill */}
            <div 
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs"
              title={health ? `FastAPI: ${health.status}` : 'Connecting...'}
            >
              <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-slate-500">Qdrant:</span>
              <span className="font-mono font-medium text-slate-800">low-setu-project</span>
            </div>

            {/* Sarvam AI Status Pill */}
            <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span className="text-slate-500">Speech:</span>
              <span className="font-medium text-slate-800">Saaras V4 + gTTS</span>
            </div>

            {/* Join WhatsApp Sandbox Button */}
            <button
              onClick={() => setShowSandboxModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium shadow-sm transition-all shadow-emerald-600/20 hover:shadow-emerald-600/30"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Join WhatsApp Sandbox</span>
              <span className="sm:hidden">WhatsApp</span>
            </button>
          </div>
        </div>
      </header>

      {/* WhatsApp Sandbox Modal */}
      {showSandboxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden relative">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Twilio WhatsApp Sandbox</h3>
                  <p className="text-xs text-slate-500">Test live regional voice queries from your phone</p>
                </div>
              </div>
              <button
                onClick={() => setShowSandboxModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Instructions Steps */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800">Send WhatsApp Message to Number</p>
                    <p className="font-mono text-slate-600 mt-0.5">{sandboxNumber}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    2
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-emerald-900">Send Sandbox Join Code</p>
                    <div className="flex items-center justify-between mt-1 bg-white px-2.5 py-1.5 rounded-lg border border-emerald-300">
                      <span className="font-mono font-bold text-emerald-700">{joinPhrase}</span>
                      <button
                        onClick={handleCopy}
                        className="text-xs text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-medium ml-2"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800">Ask Any Government Scheme Query</p>
                    <p className="text-slate-600 mt-0.5">
                      Send voice notes or text in Marathi, Hindi, Gujarati, or English.
                    </p>
                  </div>
                </div>
              </div>

              {/* Direct Link Action */}
              <a
                href={whatsappDeepLink}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all"
              >
                <span>Open WhatsApp Directly on Phone/Web</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
