import api from "./api";

const KEY_MAP = {
  yearFrom: "year_from",
  yearTo: "year_to",
  latMin: "lat_min",
  latMax: "lat_max",
  lngMin: "lng_min",
  lngMax: "lng_max",
  tags: "tags",
  latitude: "latitude",
  longitude: "longitude",
  radiusKm: "radius_km",
  hasImage: "has_image",
  page: "page",
  pageSize: "page_size",
};

// Hard cap on the fallback fetch (mirrors the backend's StoryPagination
// max_page_size and the cap mobile uses for the same fallback path).
//
// Known limitation: when an unsupported filter combination forces the
// fallback (q / free-text location), the client fetches at most this many
// stories from /stories/timeline/, applies q and location text client-side,
// and paginates the slice. Stories that match the text filter but rank beyond
// the 100th in the timeline's historical order are not reachable via the
// timeline view, and `count` reflects only what was fetched — not the true
// backend count. Same trade-off mobile makes.
const FALLBACK_FETCH_PAGE_SIZE = 100;

function hasUnsupportedTimelineFilters(filters) {
  if (filters.q?.trim()) return true;
  // A location string with no bbox can't be passed to /stories/timeline/ —
  // that endpoint doesn't accept a `location` text param.
  const hasBbox =
    filters.latMin != null && filters.latMax != null && filters.lngMin != null && filters.lngMax != null;
  if (filters.location?.trim() && !hasBbox) return true;
  return false;
}

/**
 * Fetch stories ordered by time period for the timeline view.
 *
 * When the active filter set is supported by `/stories/timeline/` (year,
 * bbox, tags, proximity, has_image), this proxies that endpoint directly so
 * the server's historical ordering and pagination are preserved. When the
 * filter set includes text search (`q`) or a location string without a bbox,
 * the timeline endpoint can't honour them — so we still call
 * `/stories/timeline/` for all server-supported params, then apply `q` and
 * `location` text as client-side substring filters on the fetched results.
 * This ensures `photo_url` is always present in the response, giving
 * consistent card rendering regardless of active filters.
 */
export async function getTimeline({
  yearFrom,
  yearTo,
  latMin,
  latMax,
  lngMin,
  lngMax,
  q,
  tags,
  location,
  latitude,
  longitude,
  radiusKm,
  hasImage,
  page,
  pageSize,
} = {}) {
  const filters = { q, tags, location, latMin, latMax, lngMin, lngMax, latitude, longitude, radiusKm };

  if (!hasUnsupportedTimelineFilters(filters)) {
    // Forward has_image only when explicitly true. The timeline endpoint
    // treats absent has_image as "no image filter," which matches our intent
    // when the toggle is off.
    const args = {
      yearFrom,
      yearTo,
      latMin,
      latMax,
      lngMin,
      lngMax,
      tags,
      latitude,
      longitude,
      radiusKm,
      page,
      pageSize,
      ...(hasImage ? { hasImage: true } : {}),
    };
    const params = {};
    for (const [key, value] of Object.entries(args)) {
      if (value === undefined) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      params[KEY_MAP[key]] = value;
    }
    const response = await api.get("/stories/timeline/", { params });
    return response.data;
  }

  return getTimelineViaFallback({
    yearFrom,
    yearTo,
    latMin,
    latMax,
    lngMin,
    lngMax,
    q,
    tags,
    location,
    latitude,
    longitude,
    radiusKm,
    hasImage,
    page: page ?? 1,
    pageSize: pageSize ?? 10,
  });
}

async function getTimelineViaFallback({
  yearFrom,
  yearTo,
  latMin,
  latMax,
  lngMin,
  lngMax,
  q,
  tags,
  location,
  latitude,
  longitude,
  radiusKm,
  hasImage,
  page,
  pageSize,
}) {
  // Always call /stories/timeline/ so results include photo_url, correct
  // interval-overlap year semantics, and historical sort order.
  // q and location text (without bbox) are not supported by the timeline
  // endpoint — apply them as client-side substring filters after the fetch.
  const args = {
    yearFrom,
    yearTo,
    latMin,
    latMax,
    lngMin,
    lngMax,
    tags,
    latitude,
    longitude,
    radiusKm,
    pageSize: FALLBACK_FETCH_PAGE_SIZE,
    ...(hasImage ? { hasImage: true } : {}),
  };
  const params = {};
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    params[KEY_MAP[key]] = value;
  }

  const response = await api.get("/stories/timeline/", { params });
  const allResults = Array.isArray(response.data?.results) ? response.data.results : [];

  const qNorm = q?.trim().toLowerCase();
  const locNorm = location?.trim().toLowerCase();
  const matching =
    qNorm || locNorm
      ? allResults.filter((s) => {
          if (qNorm) {
            if (
              !s.title?.toLowerCase().includes(qNorm) &&
              !s.location_name?.toLowerCase().includes(qNorm)
            )
              return false;
          }
          if (locNorm && !s.location_name?.toLowerCase().includes(locNorm)) return false;
          return true;
        })
      : allResults;

  const startIndex = (page - 1) * pageSize;
  const pageResults = matching.slice(startIndex, startIndex + pageSize);
  const hasNext = startIndex + pageSize < matching.length;

  return {
    count: matching.length,
    next: hasNext ? "client-next-page" : null,
    previous: page > 1 ? "client-previous-page" : null,
    results: pageResults,
  };
}
