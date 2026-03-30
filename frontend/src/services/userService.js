import api from "./api";

export async function getProfile() {
  const response = await api.get("/users/me/");
  return response.data;
}

export async function getUserStories({ page = 1, pageSize = 12 } = {}) {
  const response = await api.get("/users/me/stories/", {
    params: { page, page_size: pageSize },
  });
  return response.data; // { count, next, previous, results }
}
