import api from "./api";

const PAGE_SIZE = 12;

export async function getStories({ page = 1, pageSize = PAGE_SIZE, sortBy = "recent" } = {}) {
  const response = await api.get("/stories/feed/", {
    params: { page, page_size: pageSize, sort_by: sortBy },
  });
  return response.data; // { count, next, previous, results }
}

export async function getMapStories(filters = {}) {
  const response = await api.get("/stories/map/", { params: filters });
  return response.data.results; // [{ id, title, location_name, location_lat, location_lng, time_type, year, year_start, year_end }]
}

export async function createStory(formData) {
  const response = await api.post("/stories/", formData);
  return response.data;
}

export async function getStoryById(id) {
  const response = await api.get(`/stories/${id}/`);
  return response.data;
}
