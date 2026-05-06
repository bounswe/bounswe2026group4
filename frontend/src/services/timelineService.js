import api from "./api";

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

/**
 * Fetch stories ordered by time period for the timeline view.
 *
 * Calls `GET /stories/timeline/`. Accepts camelCase JS args and translates them
 * to snake_case query params expected by the backend. Undefined args are
 * omitted from the request.
 */
export async function getTimeline({
  yearFrom,
  yearTo,
  latMin,
  latMax,
  lngMin,
  lngMax,
  hasImage,
  page,
  pageSize,
} = {}) {
  const args = { yearFrom, yearTo, latMin, latMax, lngMin, lngMax, hasImage, page, pageSize };
  const params = {};
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;
    params[KEY_MAP[key]] = value;
  }
  const response = await api.get("/stories/timeline/", { params });
  return response.data;
}
