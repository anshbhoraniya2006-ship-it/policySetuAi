import type { SystemHealth, TelemetryEvent, QdrantStats, IngestResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function fetchHealth(): Promise<SystemHealth> {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchQdrantStats(): Promise<QdrantStats> {
  const res = await fetch(`${API_BASE_URL}/api/qdrant/stats`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Qdrant stats: ${res.statusText}`);
  }
  return res.json();
}

export async function ingestUrl(
  url: string,
  state = 'All India',
  sector = 'Agriculture',
  schemeName?: string
): Promise<IngestResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ingest/url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      state,
      sector,
      scheme_name: schemeName || undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ingestion failed: ${res.statusText}`);
  }
  return res.json();
}

export async function ingestPdf(
  file: File,
  state = 'All India',
  sector = 'Agriculture',
  schemeName?: string
): Promise<IngestResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('state', state);
  formData.append('sector', sector);
  if (schemeName) {
    formData.append('scheme_name', schemeName);
  }

  const res = await fetch(`${API_BASE_URL}/api/ingest/pdf`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`PDF Ingestion failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchLatestTelemetry(limit = 10): Promise<{ count: number; logs: TelemetryEvent[] }> {
  const res = await fetch(`${API_BASE_URL}/api/telemetry/latest?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch telemetry: ${res.statusText}`);
  }
  const data = await res.json();
  if (Array.isArray(data)) {
    return { count: data.length, logs: data };
  }
  return {
    count: data.count || (data.logs ? data.logs.length : 0),
    logs: data.logs || []
  };
}

export async function submitTextQuery(
  queryText: string,
  phoneNumber = 'whatsapp:+919510010478',
  latitude?: number,
  longitude?: number
): Promise<TelemetryEvent> {
  const res = await fetch(`${API_BASE_URL}/test-voice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query_text: queryText,
      phone_number: phoneNumber,
      latitude: latitude || null,
      longitude: longitude || null,
    }),
  });

  if (!res.ok) {
    throw new Error(`Text query failed: ${res.statusText}`);
  }
  return res.json();
}

export async function submitVoiceUpload(
  audioBlob: Blob,
  phoneNumber = 'whatsapp:+919510010478'
): Promise<TelemetryEvent> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'mic_recording.wav');
  formData.append('phone_number', phoneNumber);

  const res = await fetch(`${API_BASE_URL}/test-voice-upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Voice upload failed: ${res.statusText}`);
  }
  return res.json();
}

export function resolveAudioUrl(urlPath?: string): string {
  if (!urlPath) return '';
  if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) {
    return urlPath;
  }
  return `${API_BASE_URL}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
}
