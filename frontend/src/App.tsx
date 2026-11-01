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
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden selection:bg-orange-100 selection:text-orange-900">
      {/* Top Navbar (Fixed 67px height: 64px + 3px hairline) */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        isLiveConnected={isLiveConnected}
      />

      {/* Main Workspace (Strictly fills exactly remaining height without any window scrollbar) */}
      <main className="flex-1 h-[calc(100vh-67px)] w-full max-w-[1800px] mx-auto p-2.5 sm:p-3 lg:p-4 overflow-y-auto lg:overflow-hidden flex flex-col min-h-0">
        {activeTab === 'console' ? (
          /* Strict 3-Tier Responsive Layout:
             1. Mobile (< 768px): Vertical stack; chat takes full screen, cards scroll below
             2. Tablet (768px - 1023px): Chat spans 100% width; CSC & Telemetry cards side-by-side in 2-cols below
             3. Laptop/Desktop (>= 1024px): Exact screen height with ZERO right-side or page scrollbars
          */
          <div className="h-full flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 lg:gap-4 overflow-y-auto lg:overflow-hidden items-stretch">
            {/* Left Column: WhatsApp-Style Citizen Voice Mirror */}
            <div className="col-span-1 md:col-span-2 lg:col-span-8 h-[calc(100dvh-5.5rem)] md:h-[620px] lg:h-full min-h-0 flex flex-col overflow-hidden">
              <CitizenVoiceMirror
                currentEvent={currentEvent}
                onQueryExecuted={(event) => setCurrentEvent(event)}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                onResetSession={handleResetSession}
              />
            </div>

            {/* Right Column: Exactly fits remaining vertical space; NEVER triggers a scrollbar */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4 h-auto lg:h-full min-h-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3 overflow-hidden">
              {/* Card 1: Nearest CSC Locator (flex-1) */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <CSCMapCard
                  csc={currentEvent?.csc_center}
                  citizenProfile={currentEvent?.citizen_profile}
                  isLoading={isLoading}
                />
              </div>

              {/* Card 2: Agro-Weather Telemetry (flex-1) */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <TelemetryCard
                  weather={currentEvent?.weather_data}
                  verdict={currentEvent?.verdict}
                  citizenProfile={currentEvent?.citizen_profile}
                  isLoading={isLoading}
                />
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
