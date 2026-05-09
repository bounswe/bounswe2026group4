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

/**
 * Compute the historical-year midpoint for a story so the client can sort
 * fallback-fetched results the same way the timeline endpoint does on the
 * server. Returns Number.MAX_SAFE_INTEGER for stories with no usable time
 * info so they sink to the bottom rather than crash the comparator.
 *
 * Mirrors the server-side CASE expression in
 * `backend/apps/stories/services.py::get_story_timeline`.
 */
export function getTimelineHistoricalYear(story) {
  if (!story || typeof story !== "object") return Number.MAX_SAFE_INTEGER;
  const { time_type, year, year_start, year_end, date_value } = story;
  if (time_type === "year_range" && Number.isFinite(year_start) && Number.isFinite(year_end)) {
    return (year_start + year_end) / 2;
  }
  if (time_type === "decade" && Number.isFinite(year)) {
    return year + 5;
  }
  if (time_type === "exact_date" && typeof date_value === "string") {
    const parsedYear = Number.parseInt(date_value.slice(0, 4), 10);
    return Number.isFinite(parsedYear) ? parsedYear : Number.MAX_SAFE_INTEGER;
  }
  if (Number.isFinite(year)) return year;
  return Number.MAX_SAFE_INTEGER;
}

function getStoryYearInterval(story) {
  if (!story || typeof story !== "object") return null;
  const { time_type, year, year_start, year_end, date_value } = story;
  if (time_type === "year_range" && Number.isFinite(year_start) && Number.isFinite(year_end)) {
    return [year_start, year_end];
  }
  if (time_type === "decade" && Number.isFinite(year)) {
    return [year, year + 9];
  }
  if (time_type === "exact_date" && typeof date_value === "string") {
    const parsedYear = Number.parseInt(date_value.slice(0, 4), 10);
    return Number.isFinite(parsedYear) ? [parsedYear, parsedYear] : null;
  }
  if (Number.isFinite(year)) return [year, year];
  return null;
}

/**
 * Same interval-overlap year filter the /stories/timeline/ endpoint applies
 * server-side. Re-applied client-side for the fallback path because
 * /stories/feed/ and /stories/search/ use a simpler `year__gte` / `year__lte`
 * check that silently excludes decade and exact_date stories whose intervals
 * the timeline endpoint would include. yearFrom/yearTo of null mean "no bound."
 */
export function storyOverlapsYearWindow(story, yearFrom, yearTo) {
  if (yearFrom == null && yearTo == null) return true;
  const interval = getStoryYearInterval(story);
  if (!interval) return false;
  const [start, end] = interval;
  if (yearFrom != null && end < yearFrom) return false;
  if (yearTo != null && start > yearTo) return false;
  return true;
}

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
