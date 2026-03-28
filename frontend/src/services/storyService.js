import api from "./api";

const PAGE_SIZE = 12;

export async function getStories({ page = 1, pageSize = PAGE_SIZE, sortBy = "recent" } = {}) {
  const response = await api.get("/stories/feed/", {
    params: { page, page_size: pageSize, sort_by: sortBy },
  });
  return response.data; // { count, next, previous, results }
}
