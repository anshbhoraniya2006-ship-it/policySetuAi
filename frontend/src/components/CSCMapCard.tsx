import React from 'react';
import { MapPin, Navigation, ExternalLink, Compass } from 'lucide-react';
import type { CSCLocation, CitizenProfile } from '../types';

interface CSCMapCardProps {
  csc?: CSCLocation | null;
  citizenProfile?: CitizenProfile | null;
  isLoading?: boolean;
}

export const CSCMapCard: React.FC<CSCMapCardProps> = ({
  csc,
  citizenProfile,
  isLoading = false,
}) => {
  // Dynamic location extraction from RAG payload or google_maps_url
  let lat = csc?.latitude;
  let lon = csc?.longitude;

  if ((lat === undefined || lon === undefined) && csc?.google_maps_url) {
    const match = csc.google_maps_url.match(/destination=([0-9.-]+),([0-9.-]+)/);
    if (match) {
      lat = parseFloat(match[1]);
      lon = parseFloat(match[2]);
    }
  }

  const effectiveLat = lat ?? 20.5937;
  const effectiveLon = lon ?? 78.9629;
  const distanceKm = csc?.distance_km ?? 1.8;

  const districtName = citizenProfile?.district_or_village || '';
  const stateName = citizenProfile?.state || '';
  const centerName = csc?.center_name || (districtName ? `Public Service Centre, ${districtName}` : 'Public Service Centre');
  const address = csc?.address || (districtName && stateName ? `Tehsil Complex, ${districtName}, ${stateName}` : '');
  const googleMapsUrl =
    csc?.google_maps_url ||
    `https://www.google.com/maps/dir/?api=1&destination=${effectiveLat.toFixed(4)},${effectiveLon.toFixed(4)}`;

  const delta = 0.025;
  const minLon = (effectiveLon - delta).toFixed(4);
  const minLat = (effectiveLat - delta).toFixed(4);
  const maxLon = (effectiveLon + delta).toFixed(4);
  const maxLat = (effectiveLat + delta).toFixed(4);
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${effectiveLat.toFixed(4)}%2C${effectiveLon.toFixed(4)}`;

  return (
    <div className="group relative h-full bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-elevated transition-all duration-300 hover:shadow-ambient flex flex-col justify-between overflow-hidden">
      {/* Decorative top accent */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-full pointer-events-none" />

      {/* Card Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-900 border border-blue-100 flex items-center justify-center font-bold shadow-xs shrink-0">
            <MapPin className="w-3.5 h-3.5 text-blue-800" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              Nearest CSC Locator
            </h3>
            <p className="text-[9.5px] text-slate-400 font-medium">Civic Service Center</p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {distanceKm.toFixed(1)} km
        </span>
      </div>

      {/* Center Details */}
      <div className="my-1.5 space-y-0.5 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-800 line-clamp-1 flex-1" title={centerName}>
            {centerName}
          </h4>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-mono text-slate-500 shrink-0">
            <Compass className="w-2.5 h-2.5 text-slate-400" />
            {effectiveLat.toFixed(2)}, {effectiveLon.toFixed(2)}
          </span>
        </div>
        <p className="text-[10.5px] text-slate-500 line-clamp-1" title={address}>
          {address}
        </p>
      </div>

      {/* Interactive Map Frame */}
      <div className="relative w-full flex-1 min-h-[105px] max-h-[140px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-inner group/map">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Locating...
            </div>
          </div>
        )}
        <iframe
          src={osmUrl}
          title="Nearest CSC Map Location"
          className="w-full h-full border-0"
          loading="lazy"
        />
        <div className="absolute bottom-1 right-2 bg-white/80 backdrop-blur-xs text-[8px] text-slate-500 px-1 py-0.5 rounded font-mono pointer-events-none">
          © OpenStreetMap
        </div>
      </div>

      {/* Navigation CTA Button */}
      <div className="mt-2 shrink-0">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-blue-50/90 hover:bg-blue-100/90 border border-blue-200 text-blue-900 text-xs font-bold shadow-xs transition-all duration-200 hover:shadow-sm active:scale-[0.99] group/btn"
        >
          <Navigation className="w-3 h-3 text-blue-700 transition-transform group-hover/btn:-rotate-12" />
          <span>Open Google Maps Navigation</span>
          <ExternalLink className="w-3 h-3 text-blue-500" />
        </a>
      </div>
    </div>
  );
};

export default CSCMapCard;
