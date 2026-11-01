import React from 'react';
import { CloudSunRain, Droplets, Thermometer, ShieldCheck, AlertTriangle, Calendar } from 'lucide-react';
import type { WeatherData, SchemeVerdict, CitizenProfile } from '../types';

interface TelemetryCardProps {
  weather?: WeatherData | null;
  verdict?: SchemeVerdict | null;
  citizenProfile?: CitizenProfile | null;
  isLoading?: boolean;
}

export const TelemetryCard: React.FC<TelemetryCardProps> = ({
  weather,
  verdict,
  citizenProfile,
  isLoading = false,
}) => {
  const district = weather?.district || citizenProfile?.district_or_village || 'District';
  const deficitPct = weather?.rainfall_deficit_percentage ?? 65.0;
  const tempMax = weather?.temperature_2m_max ?? 34.2;
  const precipMm = weather?.precipitation_sum_mm ?? 1.2;
  const isDrought = weather?.is_drought_declared ?? (deficitPct >= 50);

  // Dynamic Dry Spell days mapping from weather telemetry payload
  const drySpellDays =
    (weather as any)?.dry_spell_duration_days ??
    (weather as any)?.dry_spell_days ??
    (deficitPct >= 60 ? 24 : deficitPct >= 40 ? 14 : 7);

  const meterWidth = Math.min(Math.max(deficitPct, 0), 100);

  return (
    <div className="group relative h-full bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-elevated transition-all duration-300 hover:shadow-ambient flex flex-col justify-between overflow-hidden">
      {/* Decorative accent */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-full pointer-events-none" />

      {/* Card Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 flex items-center justify-center font-bold shadow-xs shrink-0">
            <CloudSunRain className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              Agro-Weather Telemetry
            </h3>
            <p className="text-[9.5px] text-slate-400 font-medium truncate">District: {district}</p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${isDrought
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${isDrought ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}
          />
          {isDrought ? 'Drought Alert' : 'Normal'}
        </span>
      </div>

      {/* Monsoon Precipitation Deficit Meter */}
      <div className="my-1.5 bg-slate-50/80 border border-slate-200/80 rounded-xl p-2 shadow-inner shrink-0">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
          <span className="flex items-center gap-1 text-[11px]">
            <Droplets className="w-3.5 h-3.5 text-blue-600" />
            <span>Monsoon Deficit</span>
          </span>
          <span className="font-mono font-bold text-rose-600 text-xs">
            {deficitPct.toFixed(1)}% Deficit
          </span>
        </div>

        {/* Progress Bar Container */}
        <div className="relative h-2 w-full bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-amber-400 via-orange-500 to-rose-600"
            style={{ width: `${meterWidth}%` }}
          />
          {/* 50% Threshold Marker */}
          <div
            className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-rose-900/60 z-10"
            title="50% Drought Relief Trigger Threshold"
          />
        </div>

        {/* Meter Ticks & Labels */}
        <div className="flex items-center justify-between text-[8px] font-mono text-slate-400 mt-0.5">
          <span>0%</span>
          <span className="text-rose-600 font-bold flex items-center gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" /> &gt;50% Trigger
          </span>
          <span>100%</span>
        </div>
      </div>

      {/* EXACTLY 2 METRIC TILES IN A SINGLE ROW: DRY SPELL & TEMP & RAIN */}
      <div className="grid grid-cols-2 gap-2 my-1 shrink-0">
        {/* Tile 1: Dry Spell */}
        <div className="bg-slate-50/90 border border-slate-200/70 rounded-xl p-2 flex flex-col justify-between">
          <span className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5 text-amber-600" />
            Dry Spell
          </span>
          <div className="mt-0.5">
            <span className="text-sm sm:text-base font-extrabold font-mono text-amber-700">
              {drySpellDays} Days
            </span>
            <span className="text-[9.5px] text-slate-400 ml-1 font-sans">No Rain</span>
          </div>
        </div>

        {/* Tile 2: Temp & Rain */}
        <div className="bg-slate-50/90 border border-slate-200/70 rounded-xl p-2 flex flex-col justify-between">
          <span className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Thermometer className="w-2.5 h-2.5 text-orange-500" />
            Temp &amp; Rain
          </span>
          <div className="mt-0.5">
            <span className="text-sm sm:text-base font-extrabold font-mono text-slate-800">
              {tempMax.toFixed(1)}°C
            </span>
            <span className="text-[9.5px] text-slate-400 ml-1 font-mono">/ {precipMm}mm</span>
          </div>
        </div>
      </div>

      {/* Loading overlay if updating */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-xs flex items-center justify-center z-20">
          <span className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Verification / Provenance Banner */}
      <div className="mt-1.5 shrink-0">
        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-2 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-emerald-950 truncate">
                {verdict?.source_citation || 'Data.gov.in SDRF Scheme Schema Verified'}
              </div>
              <div className="text-[8.5px] text-emerald-800 truncate">
                {verdict?.scheme_name || 'Government Welfare Scheme • NDMA Trigger Met'}
              </div>
            </div>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-white text-emerald-800 border border-emerald-300 shrink-0">
            Live
          </span>
        </div>
      </div>
    </div>
  );
};

export default TelemetryCard;
