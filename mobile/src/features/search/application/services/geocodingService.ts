import { apiClient } from '../../../../core/api/client';

export interface LocationBounds {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

export interface LocationSuggestion {
  id: string;
  title: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
  bounds?: LocationBounds;
}

type BackendBounds = {
  lat_min?: unknown;
  lat_max?: unknown;
  lng_min?: unknown;
  lng_max?: unknown;
  latMin?: unknown;
  latMax?: unknown;
  lngMin?: unknown;
  lngMax?: unknown;
};

type BackendLocationSuggestion = {
  id?: unknown;
  title?: unknown;
  subtitle?: unknown;
  bbox?: unknown;
};

export async function geocodeLocationQuery(query: string): Promise<LocationBounds | null> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return null;
  }

  const response = await apiClient.get<BackendBounds | null>(
    `/geocode/?q=${encodeURIComponent(normalizedQuery)}`,
  );

  return parseBackendBounds(response);
}

export async function searchLocationSuggestions(query: string): Promise<LocationSuggestion[]> {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 3) {
    return [];
  }

  const response = await apiClient.get<BackendLocationSuggestion[]>(
    `/geocode/suggestions/?q=${encodeURIComponent(normalizedQuery)}`,
  );

  if (!Array.isArray(response)) {
    return [];
  }

  return response.map(parseBackendSuggestion).filter((result): result is LocationSuggestion => result != null);
}

export function parseBackendBounds(value: unknown): LocationBounds | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as BackendBounds;
  const latMin = Number(record.lat_min ?? record.latMin);
  const latMax = Number(record.lat_max ?? record.latMax);
  const lngMin = Number(record.lng_min ?? record.lngMin);
  const lngMax = Number(record.lng_max ?? record.lngMax);

  if (![latMin, latMax, lngMin, lngMax].every(Number.isFinite)) {
    return null;
  }

  return {
    latMin: Math.min(latMin, latMax),
    latMax: Math.max(latMin, latMax),
    lngMin: Math.min(lngMin, lngMax),
    lngMax: Math.max(lngMin, lngMax),
  };
}

function parseBackendSuggestion(result: BackendLocationSuggestion): LocationSuggestion | null {
  const bounds = parseBackendBounds(result.bbox);
  const title = typeof result.title === 'string' ? result.title.trim() : '';

  if (!bounds || !title) {
    return null;
  }

  const id =
    typeof result.id === 'string' || typeof result.id === 'number'
      ? String(result.id)
      : `${bounds.latMin},${bounds.lngMin}`;
  const subtitle = typeof result.subtitle === 'string' && result.subtitle.trim()
    ? result.subtitle.trim()
    : undefined;

  return {
    id,
    title,
    subtitle,
    latitude: (bounds.latMin + bounds.latMax) / 2,
    longitude: (bounds.lngMin + bounds.lngMax) / 2,
    bounds,
  };
}
