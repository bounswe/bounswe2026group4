import api from "./api";

export async function searchTags(q) {
  const response = await api.get("/tags/", { params: { q } });
  const data = response.data;
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function createOrGetTag(name) {
  const response = await api.post("/tags/", { name });
  return response.data;
}

export async function getTagStories(slug, { page = 1, pageSize = 12 } = {}) {
  const response = await api.get("/stories/feed/", {
    params: { tag: slug, page, page_size: pageSize },
  });
  return response.data;
}
