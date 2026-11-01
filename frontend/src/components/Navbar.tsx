import React from 'react';
import {
  Radio,
  Database,
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
  return (
    <>
      {/* Top Navigation Bar with DPI Tricolor Hairline */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
        {/* India DPI Tricolor Top Accent */}
        <div className="dpi-tricolor-hairline" />

        <div className="max-w-[1720px] mx-auto px-3 sm:px-6 lg:px-8 h-13 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Brand Identity with Sovereign DPI Hub SVG */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center shrink-0 shadow-md shadow-blue-950/20 border border-white/15 transition-transform hover:scale-105">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="sm:w-[22px] sm:h-[22px]">
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
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  Policy-Setu <span className="text-blue-900">AI</span>
                </h1>
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
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
          <div className="hidden md:flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('console')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTab === 'console'
                  ? 'bg-white text-blue-950 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-blue-800" />
              <span>Voice &amp; Scheme Console</span>
            </button>
            <button
              onClick={() => setActiveTab('ingestion')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTab === 'ingestion'
                  ? 'bg-white text-blue-950 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mandate Ingestion &amp; Qdrant</span>
            </button>
          </div>

          {/* Right: Live Status & Engine Connection */}
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

            {/* Live Web Engine Status Pill */}
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
              <span className="hidden sm:inline">Voice Engine Active</span>
              <span className="sm:hidden">Active</span>
            </div>
          </div>
        </div>

        {/* Mobile View Switcher Tabs Bar */}
        <div className="flex md:hidden border-t border-slate-200 bg-slate-50 px-3 py-1.5 items-center justify-center gap-2">
          <button
            onClick={() => setActiveTab('console')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-lg text-xs font-semibold ${
              activeTab === 'console'
                ? 'bg-white text-blue-900 shadow-xs border border-slate-200'
                : 'text-slate-600'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-blue-800" />
            <span>Voice Console</span>
          </button>
          <button
            onClick={() => setActiveTab('ingestion')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-lg text-xs font-semibold ${
              activeTab === 'ingestion'
                ? 'bg-white text-blue-900 shadow-xs border border-slate-200'
                : 'text-slate-600'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ingestion</span>
          </button>
        </div>
      </header>
    </>
  );
};

export default Navbar;
