export interface CitizenProfile {
  state?: string | null;
  district_or_village?: string | null;
  land_value?: number | null;
  land_unit?: string | null;
  crop_type?: string | null;
  sector_or_intent?: string | null;
  missing_critical_question?: string | null;
}

export interface CSCLocation {
  center_name?: string;
  address?: string;
  distance_km?: number;
  latitude?: number;
  longitude?: number;
  google_maps_url?: string;
  source?: string;
}

export interface WeatherData {
  rainfall_deficit_percentage?: number;
  precipitation_sum_mm?: number;
  temperature_2m_max?: number;
  temperature_2m_min?: number;
  weather_condition?: string;
  district?: string;
  is_drought_declared?: boolean;
}

export interface QdrantChunk {
  chunk_id?: string | number;
  scheme_name: string;
  state: string;
  sector: string;
  section?: string;
  score?: number;
  text_content: string;
  table_markdown?: string;
  pdf_source_url?: string;
}

export interface SchemeVerdict {
  scheme_name: string;
  is_eligible: boolean;
  confidence_score?: number;
  entitlement_summary: string;
  exact_three_documents: string[];
  local_language_script: string;
  english_voice_script: string;
  source_citation: string;
  verification_hash?: string;
}

export interface TelemetryEvent {
  session_id: string;
  phone_number: string;
  incoming_audio_url?: string;
  language_code: string;
  native_transcript: string;
  english_translation: string;
  citizen_profile: CitizenProfile;
  land_in_hectares?: number;
  csc_center: CSCLocation;
  weather_data: WeatherData;
  data_gov_data?: Record<string, any>;
  rag_chunks: QdrantChunk[];
  verdict: SchemeVerdict;
  outbound_audio_url?: string;
  total_latency_ms: number;
  status: "SUCCESS" | "FAILED" | "PENDING";
  timestamp?: string;
}

export interface SystemHealth {
  status: string;
  timestamp: number;
  services: {
    twilio_configured: boolean;
    sarvam_configured: boolean;
    gemini_configured: boolean;
    qdrant_configured: boolean;
    supabase_configured: boolean;
    data_gov_configured: boolean;
    osm_overpass: string;
    open_meteo: string;
  };
}

export interface QdrantStats {
  collection_name: string;
  internal_collection?: string;
  points_count: number;
  status: string;
  dense_dimensions?: number;
  hybrid_mode?: string;
  cluster?: string;
  indexed_schemes?: string[];
  timestamp?: number;
}

export interface IngestChunkItem {
  id: number | string;
  header: string;
  token_estimate: number;
  text_preview: string;
  full_text: string;
  metadata: {
    state: string;
    sector: string;
    source_url: string;
    published_date: string;
    scheme_name?: string;
    [key: string]: any;
  };
}

export interface IngestResponse {
  status: string;
  scheme_name: string;
  source_url: string;
  state: string;
  sector: string;
  chunks_count: number;
  tables_extracted: string[];
  chunks: IngestChunkItem[];
  stats?: QdrantStats;
}

