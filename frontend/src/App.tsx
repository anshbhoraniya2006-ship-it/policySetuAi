import { useState, useEffect } from 'react';
import {
  Navbar,
  CitizenVoiceMirror,
  CSCMapCard,
  TelemetryCard,
  MandateIngestionView,
} from './components';
import type { TelemetryEvent, SystemHealth } from './types';
import { fetchHealth, fetchLatestTelemetry } from './services';

export function App() {
  const [activeTab, setActiveTab] = useState<'console' | 'ingestion'>('console');
  const [mobileConsoleTab, setMobileConsoleTab] = useState<'chat' | 'telemetry'>('chat');
  const [currentEvent, setCurrentEvent] = useState<TelemetryEvent | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Poll health and latest telemetry
  useEffect(() => {
    let isMounted = true;

    const checkSystemHealth = async () => {
      try {
        const h = await fetchHealth();
        if (isMounted) {
          setHealth(h);
          setIsLiveConnected(true);
        }
      } catch {
        if (isMounted) setIsLiveConnected(false);
      }
    };

    const loadLatestTelemetry = async () => {
      try {
        const data = await fetchLatestTelemetry(5);
        if (isMounted && data.logs && data.logs.length > 0) {
          setCurrentEvent((prev) => prev || data.logs[0]);
        }
      } catch {
        // Silently wait for backend
      }
    };

    checkSystemHealth();
    loadLatestTelemetry();

    const interval = setInterval(() => {
      checkSystemHealth();
      loadLatestTelemetry();
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleResetSession = () => {
    setCurrentEvent(null);
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] flex flex-col bg-slate-50 overflow-hidden selection:bg-orange-100 selection:text-orange-900">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        isLiveConnected={isLiveConnected}
      />

      {/* Main Workspace (Strictly fills exactly remaining height without any window scrollbar) */}
      <main className="flex-1 min-h-0 w-full max-w-[1800px] mx-auto p-1.5 sm:p-2.5 lg:p-4 flex flex-col overflow-hidden">
        {activeTab === 'console' ? (
          <div className="h-full flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Mobile Sub-Tab Switcher (< lg only) */}
            <div className="flex lg:hidden items-center bg-slate-200/90 p-1 rounded-xl mb-1.5 shrink-0 border border-slate-300/80">
              <button
                type="button"
                onClick={() => setMobileConsoleTab('chat')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mobileConsoleTab === 'chat'
                    ? 'bg-white text-blue-950 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🎙️ Citizen Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileConsoleTab('telemetry')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mobileConsoleTab === 'telemetry'
                    ? 'bg-white text-blue-950 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📍 CSC Map &amp; Telemetry</span>
                {currentEvent?.csc_center && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            </div>

            {/* Main Console Layout: Side-by-side on lg+, Sub-tabbed on mobile */}
            <div className="flex-1 min-h-0 h-full grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 overflow-hidden items-stretch">
              {/* Left Column: WhatsApp-Style Citizen Voice Mirror */}
              <div
                className={`col-span-1 lg:col-span-8 h-full min-h-0 flex-col overflow-hidden ${
                  mobileConsoleTab === 'chat' ? 'flex' : 'hidden lg:flex'
                }`}
              >
                <CitizenVoiceMirror
                  currentEvent={currentEvent}
                  onQueryExecuted={(event) => setCurrentEvent(event)}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                  onResetSession={handleResetSession}
                  onViewTelemetry={() => setMobileConsoleTab('telemetry')}
                />
              </div>

              {/* Right Column: Nearest CSC Locator & Agro-Weather Telemetry */}
              <div
                className={`col-span-1 lg:col-span-4 h-full min-h-0 overflow-y-auto lg:overflow-hidden ${
                  mobileConsoleTab === 'telemetry'
                    ? 'flex flex-col gap-3'
                    : 'hidden lg:grid lg:grid-cols-1 lg:gap-3'
                }`}
              >
                {/* Mobile Back-to-Chat Button */}
                <div className="lg:hidden flex items-center justify-between pb-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMobileConsoleTab('chat')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-blue-900 shadow-2xs hover:bg-slate-50 active:scale-95 cursor-pointer"
                  >
                    <span>← Back to Voice Chat</span>
                  </button>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {currentEvent?.citizen_profile?.district_or_village || 'District Level Telemetry'}
                  </span>
                </div>

                {/* Card 1: Nearest CSC Locator (flex-1) */}
                <div className="flex-1 min-h-[220px] lg:min-h-0 flex flex-col overflow-hidden">
                  <CSCMapCard
                    csc={currentEvent?.csc_center}
                    citizenProfile={currentEvent?.citizen_profile}
                    isLoading={isLoading}
                  />
                </div>

                {/* Card 2: Agro-Weather Telemetry (flex-1) */}
                <div className="flex-1 min-h-[220px] lg:min-h-0 flex flex-col overflow-hidden">
                  <TelemetryCard
                    weather={currentEvent?.weather_data}
                    verdict={currentEvent?.verdict}
                    citizenProfile={currentEvent?.citizen_profile}
                    isLoading={isLoading}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Tab 2: Live Mandate Ingestion & Qdrant Indexer */
          <div className="flex-1 min-h-0 overflow-y-auto">
            <MandateIngestionView />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
