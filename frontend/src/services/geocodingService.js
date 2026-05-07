import api from "./api";

const geocodeCache = new Map();
const suggestionsCache = new Map();

/** Clear in-memory caches — used in tests. */
export function clearCache() {
  geocodeCache.clear();
  suggestionsCache.clear();
}

/**
 * Geocode a place name to a bounding box via the backend proxy.
 * Returns { latMin, latMax, lngMin, lngMax } or null if no result.
 */
export async function geocodeLocation(query) {
  if (!query?.trim()) return null;

  const key = query.trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  const { data } = await api.get("/geocode/", { params: { q: query.trim() } });

  if (!data) {
    geocodeCache.set(key, null);
    return null;
  }

  const bbox = {
    latMin: data.lat_min,
    latMax: data.lat_max,
    lngMin: data.lng_min,
    lngMax: data.lng_max,
  };
  geocodeCache.set(key, bbox);
  return bbox;
}

/**
 * Fetch up to 5 location suggestions for a query (min 3 chars) via the backend proxy.
 * Each suggestion includes a display title, optional subtitle, and optional bbox.
 */
export async function searchLocationSuggestions(query) {
  const normalized = query?.trim();
  if (!normalized || normalized.length < 3) return [];

  const key = normalized.toLowerCase();
  if (suggestionsCache.has(key)) return suggestionsCache.get(key);

  const { data } = await api.get("/geocode/suggestions/", { params: { q: normalized } });

  if (!Array.isArray(data)) return [];

  const suggestions = data.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle ?? undefined,
    bbox: r.bbox
      ? {
          latMin: r.bbox.lat_min,
          latMax: r.bbox.lat_max,
          lngMin: r.bbox.lng_min,
          lngMax: r.bbox.lng_max,
        }
      : null,
  }));

  suggestionsCache.set(key, suggestions);
  return suggestions;
}
