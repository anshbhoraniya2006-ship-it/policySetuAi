import { useState, useEffect } from 'react';
import {
  Navbar,
  CitizenVoiceMirror,
  RAGPipelineInspector,
  LiveProofAndGIS,
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
          // If user hasn't triggered a new query manually yet, pick the latest real event
          setCurrentEvent((prev) => prev || data.logs[0]);
        }
      } catch {
        // Silently keep waiting
      }
    };

    checkSystemHealth();
    loadLatestTelemetry();

    // 4-second polling to capture WhatsApp messages sent from phone in real-time
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
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        isLiveConnected={isLiveConnected}
      />

      {/* Main Command Center Workspace */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'console' ? (
          /* 12-Column Responsive Bento Grid */
          <div className="grid grid-cols-12 gap-5 items-start">
            {/* Left Column: Dual-Mode Citizen Voice Mirror (col-span-12 lg:col-span-4) */}
            <div className="col-span-12 lg:col-span-4">
              <CitizenVoiceMirror
                currentEvent={currentEvent}
                onQueryExecuted={(event) => setCurrentEvent(event)}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                onResetSession={handleResetSession}
              />
            </div>

            {/* Center Column: 6-Stage AI Pipeline & Qdrant RAG Inspector (col-span-12 lg:col-span-5) */}
            <div className="col-span-12 lg:col-span-5">
              <RAGPipelineInspector currentEvent={currentEvent} />
            </div>

            {/* Right Column: Live Public API Proof & GIS Locator (col-span-12 lg:col-span-3) */}
            <div className="col-span-12 lg:col-span-3">
              <LiveProofAndGIS currentEvent={currentEvent} />
            </div>
          </div>
        ) : (
          /* Tab 2: Live Mandate Ingestion & Qdrant Indexer */
          <MandateIngestionView />
        )}
      </main>

      {/* DPI Hackathon Provenance Footer */}
      <footer className="border-t border-slate-200 bg-white/80 py-3.5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-medium text-slate-600">
            <span>🇮🇳</span>
            <span>Policy-Setu AI • Built for India Digital Public Infrastructure (DPI)</span>
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            FastAPI Port 8000 • Qdrant Cloud (low-setu-project) • Open-Meteo & OpenStreetMap
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
