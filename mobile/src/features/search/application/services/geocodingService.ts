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
}

interface NominatimSearchResult {
  boundingbox?: unknown;
  place_id?: number | string;
  osm_id?: number | string;
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
}

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'en',
  'User-Agent': 'local-history-story-map-mobile/0.1.0',
};

export async function geocodeLocationQuery(query: string): Promise<LocationBounds | null> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return null;
  }

  const params = new URLSearchParams({
    q: normalizedQuery,
    format: 'jsonv2',
    limit: '1',
    addressdetails: '1',
  });

  const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
    headers: NOMINATIM_HEADERS,
  });

  if (!response.ok) {
    throw new Error('Unable to geocode location.');
  }

  const results = (await response.json()) as NominatimSearchResult[];
  const firstResult = Array.isArray(results) ? results[0] : undefined;

  return parseNominatimBounds(firstResult?.boundingbox);
}

export async function searchLocationSuggestions(query: string): Promise<LocationSuggestion[]> {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 3) {
    return [];
  }

  const params = new URLSearchParams({
    q: normalizedQuery,
    format: 'jsonv2',
    limit: '5',
    addressdetails: '1',
  });

  const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
    headers: NOMINATIM_HEADERS,
  });

  if (!response.ok) {
    throw new Error('Unable to search locations.');
  }

  const results = (await response.json()) as NominatimSearchResult[];

  if (!Array.isArray(results)) {
    return [];
  }

  return results.map(parseNominatimSuggestion).filter((result): result is LocationSuggestion => result != null);
}

export function parseNominatimBounds(value: unknown): LocationBounds | null {
  if (!Array.isArray(value) || value.length < 4) {
    return null;
  }

  const [latMin, latMax, lngMin, lngMax] = value.map((item) => Number(item));

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

function parseNominatimSuggestion(result: NominatimSearchResult): LocationSuggestion | null {
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const displayName = result.display_name?.trim();
  const [fallbackTitle, ...fallbackRest] = displayName?.split(',').map((part) => part.trim()).filter(Boolean) ?? [];
  const title = result.name?.trim() || fallbackTitle;

  if (!title) {
    return null;
  }

  return {
    id: String(result.place_id ?? result.osm_id ?? `${latitude},${longitude}`),
    title,
    subtitle: fallbackRest.join(', ') || undefined,
    latitude,
    longitude,
  };
}
