import api from "./api";

export async function addBookmark(storyId) {
  const response = await api.post(`/stories/${storyId}/bookmark/`);
  return response.data;
}

export async function removeBookmark(storyId) {
  await api.delete(`/stories/${storyId}/bookmark/`);
}

export async function getBookmarks(userId, { page = 1, pageSize = 10 } = {}) {
  const response = await api.get(`/users/${userId}/bookmarks/`, {
    params: { page, page_size: pageSize },
  });
  return response.data;
}
