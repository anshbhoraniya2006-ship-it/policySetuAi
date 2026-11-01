import React, { useState } from 'react';
import {
  Radio,
  Database,
  Check,
  Copy,
  ExternalLink,
  X,
  Activity
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
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
        {/* India DPI Tricolor Top Accent */}
        <div className="dpi-tricolor-hairline" />

        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Left: Brand Identity with Sovereign DPI Hub SVG */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center shrink-0 shadow-md shadow-blue-950/20 border border-white/15 transition-transform hover:scale-105">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                {/* Saffron Upper Arc */}
                <path
                  d="M12 3 A9 9 0 0 1 21 12"
                  stroke="#FF9933"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                />
                {/* Emerald Lower Arc */}
                <path
                  d="M12 21 A9 9 0 0 1 3 12"
                  stroke="#10B981"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                />
                {/* Interconnect Arcs */}
                <path
                  d="M21 12 A9 9 0 0 1 12 21"
                  stroke="#38BDF8"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeDasharray="2 2"
                />
                <path
                  d="M3 12 A9 9 0 0 1 12 3"
                  stroke="#60A5FA"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                {/* Central Sovereign DPI Hub */}
                <circle cx="12" cy="12" r="3.2" fill="#FFFFFF" />
                <circle cx="12" cy="12" r="1.8" fill="#1E3A8A" />
                <circle cx="12" cy="12" r="0.8" fill="#38BDF8" />
                {/* Satellite Data Nodes */}
                <circle cx="18.5" cy="5.5" r="1.2" fill="#FF9933" />
                <circle cx="5.5" cy="18.5" r="1.2" fill="#10B981" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  Policy-Setu <span className="text-blue-900">AI</span>
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  DPI Regional Voice
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Digital Public Infrastructure • Qdrant Hybrid RAG • Indic Speech
              </p>
            </div>
          </div>

          {/* Center: View Switcher Tabs */}
          <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('console')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'console'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-blue-800" />
              <span>Command Center</span>
            </button>
            <button
              onClick={() => setActiveTab('ingestion')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'ingestion'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mandate Ingestion &amp; Qdrant Indexer</span>
            </button>
          </div>

          {/* Right: Live Status & WhatsApp Join Action */}
          <div className="flex items-center gap-2.5">
            {/* System Health Status */}
            {health && (
              <div
                className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200"
                title={`FastAPI Status: ${health.status} • Services active`}
              >
                <Activity className="w-3 h-3 text-blue-700" />
                <span>API 200 OK</span>
              </div>
            )}

            {/* Live Webhook Status Pill */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                isLiveConnected
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              <span className="hidden sm:inline">Live Voice Webhook</span>
              <span className="sm:hidden">Live</span>
            </div>

            {/* Join WhatsApp Button */}
            <button
              onClick={() => setShowSandboxModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all hover:scale-[1.02] active:scale-95"
            >
              <span>💬</span>
              <span>Join WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Mobile View Switcher Tabs Bar */}
        <div className="flex md:hidden border-t border-slate-200 bg-slate-50 px-4 py-2 items-center justify-center gap-2">
          <button
            onClick={() => setActiveTab('console')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold ${
              activeTab === 'console'
                ? 'bg-white text-blue-900 shadow-xs border border-slate-200'
                : 'text-slate-600'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-blue-800" />
            <span>Command Center</span>
          </button>
          <button
            onClick={() => setActiveTab('ingestion')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold ${
              activeTab === 'ingestion'
                ? 'bg-white text-blue-900 shadow-xs border border-slate-200'
                : 'text-slate-600'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ingestion &amp; Indexer</span>
          </button>
        </div>
      </header>

      {/* WhatsApp Sandbox Modal */}
      {showSandboxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setShowSandboxModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-3 text-2xl shadow-xs">
                💬
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Join Policy-Setu WhatsApp Channel
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Experience vernacular voice query resolution live from your mobile device
              </p>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Step 1: Save or Open Number
                </span>
                <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                  {sandboxNumber}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Step 2: Send Activation Code
                </span>
                <div className="flex items-center justify-between mt-1 bg-white p-2 rounded-lg border border-slate-200">
                  <span className="font-mono font-bold text-emerald-700">{joinPhrase}</span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href={whatsappDeepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
              >
                <span>Open in WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setShowSandboxModal(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
