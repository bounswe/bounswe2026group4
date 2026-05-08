import api from "./api";
import { getStories } from "./storyService";

const KEY_MAP = {
  yearFrom: "year_from",
  yearTo: "year_to",
  latMin: "lat_min",
  latMax: "lat_max",
  lngMin: "lng_min",
  lngMax: "lng_max",
  hasImage: "has_image",
  page: "page",
  pageSize: "page_size",
};

// Hard cap on the fallback fetch (mirrors the backend's StoryPagination
// max_page_size and the cap mobile uses for the same fallback path).
//
// Known limitation: when an unsupported filter combination forces the
// fallback (q / tags / proximity / free-text location), the client fetches
// at most this many stories from /stories/search/ or /stories/feed/, sorts
// them by historical year, and paginates the slice. Stories that match the
// filter set but rank beyond the 100th in the underlying endpoint's order
// (recent-first by default, or relevance for q) are NOT reachable via the
// timeline view, and the `count` returned reflects only what was fetched —
// not the true backend count. Same trade-off mobile makes; lifting it would
// require a backend change to expose timeline-specific filtering across the
// full result set.
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
      page,
      pageSize,
      ...(hasImage ? { hasImage: true } : {}),
    };
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
  // hasImage is intentionally accepted but unused in the fallback path —
  // see note below.
  hasImage: _hasImage,
  page,
  pageSize,
}) {
  // storyService.getStories already routes between /stories/search/ (with q)
  // and /stories/feed/, and it builds exactly the bbox/location/proximity/
  // tags param shape we need. We just borrow it as the underlying fetch.
  //
  // year_from/year_to are deliberately NOT forwarded — feed/search apply a
  // simpler `year__gte`/`year__lte` filter that drops decade and exact_date
  // stories the timeline endpoint would include via interval overlap. We
  // re-apply year filtering below with storyOverlapsYearWindow so the fallback
  // path matches the primary path's semantics.
  //
  // has_image is also NOT applied in this branch: /stories/search/ and
  // /stories/feed/ neither accept the filter param nor expose a per-story
  // image flag in StoryFeedSerializer, so a client-side filter has nothing
  // to read. The toggle silently no-ops in fallback mode; would need a
  // backend addition to apply consistently across both paths.
  const data = await getStories({
    q,
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
  const matching =
    yearFrom == null && yearTo == null
      ? allResults
      : allResults.filter((s) => storyOverlapsYearWindow(s, yearFrom, yearTo));
  // Decorate-sort-undecorate: compute the historical year once per story,
  // not twice per comparison.
  const sorted = matching
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
