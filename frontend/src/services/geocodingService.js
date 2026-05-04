const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
// User-Agent is a forbidden header name in browsers and is silently dropped by fetch.
const NOMINATIM_HEADERS = {
  "Accept-Language": "en",
};

/**
 * Geocode a place name to a bounding box using the Nominatim API.
 * Returns { latMin, latMax, lngMin, lngMax } or null if no result.
 */
export async function geocodeLocation(query) {
  if (!query?.trim()) return null;

  const url = `${NOMINATIM_BASE}?${new URLSearchParams({
    q: query.trim(),
    format: "json",
    limit: "1",
  })}`;

  const response = await fetch(url, { headers: NOMINATIM_HEADERS });

  if (!response.ok) throw new Error(`Nominatim request failed: ${response.status}`);

  const results = await response.json();
  if (!results.length) return null;

  const { boundingbox } = results[0];
  if (!boundingbox?.length) return null;

  // Nominatim boundingbox order: [lat_min, lat_max, lng_min, lng_max] (strings)
  const [latMin, latMax, lngMin, lngMax] = boundingbox.map(Number);
  return { latMin, latMax, lngMin, lngMax };
}

function parseBbox(boundingbox) {
  if (!Array.isArray(boundingbox) || boundingbox.length < 4) return null;
  const [latMin, latMax, lngMin, lngMax] = boundingbox.map(Number);
  if (![latMin, latMax, lngMin, lngMax].every(Number.isFinite)) return null;
  return { latMin, latMax, lngMin, lngMax };
}

/**
 * Fetch up to 5 location suggestions for a query (min 3 chars).
 * Each suggestion includes a display title, optional subtitle, and optional bbox.
 */
export async function searchLocationSuggestions(query) {
  const normalized = query?.trim();
  if (!normalized || normalized.length < 3) return [];

  const url = `${NOMINATIM_BASE}?${new URLSearchParams({
    q: normalized,
    format: "json",
    limit: "5",
    addressdetails: "1",
  })}`;

  const response = await fetch(url, { headers: NOMINATIM_HEADERS });

  if (!response.ok) throw new Error(`Nominatim request failed: ${response.status}`);

  const results = await response.json();
  if (!Array.isArray(results)) return [];

  return results
    .map((r) => {
      const lat = Number(r.lat);
      const lng = Number(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const parts = r.display_name?.split(",").map((p) => p.trim()).filter(Boolean) ?? [];
      const title = r.name?.trim() || parts[0];
      if (!title) return null;

      return {
        id: String(r.place_id ?? r.osm_id ?? `${lat},${lng}`),
        title,
        subtitle: parts.slice(1).join(", ") || undefined,
        bbox: parseBbox(r.boundingbox),
      };
    })
    .filter(Boolean);
}
