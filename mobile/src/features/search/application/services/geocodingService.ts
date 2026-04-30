export interface LocationBounds {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

interface NominatimSearchResult {
  boundingbox?: unknown;
}

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

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
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': 'local-history-story-map-mobile/0.1.0',
    },
  });

  if (!response.ok) {
    throw new Error('Unable to geocode location.');
  }

  const results = (await response.json()) as NominatimSearchResult[];
  const firstResult = Array.isArray(results) ? results[0] : undefined;

  return parseNominatimBounds(firstResult?.boundingbox);
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
