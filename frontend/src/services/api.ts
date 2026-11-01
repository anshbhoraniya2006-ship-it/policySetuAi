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

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'device_default';
  try {
    let id = localStorage.getItem('policysetu_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('policysetu_device_id', id);
    }
    return id;
  } catch {
    return 'device_fallback';
  }
}

export async function fetchLatestTelemetry(
  limit = 10,
  deviceSpecific = true
): Promise<{ count: number; logs: TelemetryEvent[] }> {
  const deviceParam = deviceSpecific ? `&phone_number=${encodeURIComponent(getDeviceId())}` : '';
  const res = await fetch(`${API_BASE_URL}/api/telemetry/latest?limit=${limit}${deviceParam}`);
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
  phoneNumber?: string,
  latitude?: number,
  longitude?: number
): Promise<TelemetryEvent> {
  const id = phoneNumber || getDeviceId();
  const res = await fetch(`${API_BASE_URL}/test-voice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query_text: queryText,
      phone_number: id,
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
  phoneNumber?: string
): Promise<TelemetryEvent> {
  const id = phoneNumber || getDeviceId();
  const formData = new FormData();
  const ext = audioBlob.type.includes('webm')
    ? 'webm'
    : audioBlob.type.includes('ogg')
    ? 'ogg'
    : audioBlob.type.includes('mp4')
    ? 'mp4'
    : 'wav';
  formData.append('file', audioBlob, `mic_recording.${ext}`);
  formData.append('phone_number', id);

  const res = await fetch(`${API_BASE_URL}/test-voice-upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Voice upload failed: ${res.statusText}`);
  }
  return res.json();
}

export async function resetDeviceSession(): Promise<void> {
  const id = getDeviceId();
  try {
    await fetch(`${API_BASE_URL}/api/session/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone_number: id }),
    });
  } catch (err) {
    console.warn('Failed to reset session on server:', err);
  }
}

export function resolveAudioUrl(urlPath?: string): string {
  if (!urlPath) return '';
  // If it's a blob: or data: URL (e.g. user mic recording), return directly as-is!
  if (urlPath.startsWith('blob:') || urlPath.startsWith('data:')) {
    return urlPath;
  }
  // If the backend returned a localhost/127.0.0.1 URL while running via Vite proxy or Render, normalize to relative path
  if (urlPath.includes('localhost:') || urlPath.includes('127.0.0.1:')) {
    const staticIdx = urlPath.indexOf('/static/audio/');
    if (staticIdx !== -1) {
      urlPath = urlPath.substring(staticIdx);
    }
  }
  if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) {
    return urlPath;
  }
  return `${API_BASE_URL}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
}
