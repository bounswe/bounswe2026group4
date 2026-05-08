import api from "./api";
import { getStories } from "./storyService";

const KEY_MAP = {
  yearFrom: "year_from",
  yearTo: "year_to",
  latMin: "lat_min",
  latMax: "lat_max",
  lngMin: "lng_min",
  lngMax: "lng_max",
  page: "page",
  pageSize: "page_size",
};

// How many stories to fetch from the search/feed fallback before client-sorting
// and paginating. Mirrors the cap mobile uses for the same fallback path —
// large enough for the realistic timeline corpus, small enough to keep the
// payload reasonable. Stories beyond this cap are not represented.
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

function hasUnsupportedTimelineFilters(filters) {
  if (filters.q?.trim()) return true;
  if (Array.isArray(filters.tags) && filters.tags.length > 0) return true;
  if (filters.latitude != null && filters.longitude != null && filters.radiusKm != null) return true;
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
 * When the active filter set is supported by `/stories/timeline/` (year +
 * bbox), this proxies that endpoint directly so the server's historical
 * ordering and pagination are preserved. When the filter set includes text
 * search, tags, proximity, or a location string without a bbox, the timeline
 * endpoint can't honour it — so we fall back to `/stories/search/` (when q
 * is present) or `/stories/feed/`, then re-sort client-side by historical
 * midpoint and paginate locally. This mirrors the strategy in
 * `mobile/src/features/timeline/data/sources/index.ts`.
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
  page,
  pageSize,
} = {}) {
  const filters = { q, tags, location, latMin, latMax, lngMin, lngMax, latitude, longitude, radiusKm };

  if (!hasUnsupportedTimelineFilters(filters)) {
    const args = { yearFrom, yearTo, latMin, latMax, lngMin, lngMax, page, pageSize };
    const params = {};
    for (const [key, value] of Object.entries(args)) {
      if (value === undefined) continue;
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
  page,
  pageSize,
}) {
  // storyService.getStories already routes between /stories/search/ (with q)
  // and /stories/feed/, and it builds exactly the bbox/location/proximity/
  // tags param shape we need. We just borrow it as the underlying fetch.
  const data = await getStories({
    q,
    yearFrom,
    yearTo,
    location,
    latMin,
    latMax,
    lngMin,
    lngMax,
    latitude,
    longitude,
    radiusKm,
    tags,
    page: 1,
    pageSize: FALLBACK_FETCH_PAGE_SIZE,
  });
  const allResults = Array.isArray(data?.results) ? data.results : [];
  // Decorate-sort-undecorate: compute the historical year once per story,
  // not twice per comparison.
  const sorted = allResults
    .map((story) => [getTimelineHistoricalYear(story), story])
    .sort((a, b) => a[0] - b[0])
    .map(([, story]) => story);

  const startIndex = (page - 1) * pageSize;
  const pageResults = sorted.slice(startIndex, startIndex + pageSize);
  const hasNext = startIndex + pageSize < sorted.length;

  return {
    count: sorted.length,
    next: hasNext ? "client-next-page" : null,
    previous: page > 1 ? "client-previous-page" : null,
    results: pageResults,
  };
}
