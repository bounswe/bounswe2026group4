import api from "./api";

const PAGE_SIZE = 12;

/**
 * Fetch stories for the feed view.
 * When `q` is provided, uses the /stories/search/ endpoint (title + location search).
 * Otherwise uses /stories/feed/ with optional year and location filters.
 */
export async function getStories({
  q,
  yearFrom,
  yearTo,
  location,
  page = 1,
  pageSize = PAGE_SIZE,
  sortBy = "recent",
} = {}) {
  if (q?.trim()) {
    const params = { q: q.trim(), page, page_size: pageSize };
    if (yearFrom) params.year_from = yearFrom;
    if (yearTo) params.year_to = yearTo;
    if (location?.trim()) params.location = location.trim();
    const response = await api.get("/stories/search/", { params });
    return response.data; // { count, next, previous, results }
  }

  const params = { page, page_size: pageSize, sort_by: sortBy };
  if (yearFrom) params.year_from = yearFrom;
  if (yearTo) params.year_to = yearTo;
  if (location?.trim()) params.location = location.trim();

  const response = await api.get("/stories/feed/", { params });
  return response.data; // { count, next, previous, results }
}

/**
 * Fetch story pins for the map view.
 * When `q` is provided, uses /stories/search/ and returns only stories with coordinates.
 * Otherwise uses /stories/map/ with optional year and location filters.
 */
export async function getMapStories({ q, yearFrom, yearTo, location } = {}) {
  if (q?.trim()) {
    const params = { q: q.trim(), page_size: 100 };
    if (yearFrom) params.year_from = yearFrom;
    if (yearTo) params.year_to = yearTo;
    if (location?.trim()) params.location = location.trim();
    const response = await api.get("/stories/search/", { params });
    return response.data.results.filter(
      (s) => s.location_lat != null && s.location_lng != null
    );
  }

  const params = {};
  if (yearFrom) params.year_from = yearFrom;
  if (yearTo) params.year_to = yearTo;
  if (location?.trim()) params.location = location.trim();

  const response = await api.get("/stories/map/", { params });
  return response.data.results;
}

export async function createStory(formData) {
  const response = await api.post("/stories/", formData);
  return response.data;
}
