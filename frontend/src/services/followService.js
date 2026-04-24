import api from "./api";

export async function followUser(userId) {
  const response = await api.post(`/users/${userId}/follow/`);
  return response.data;
}

export async function unfollowUser(userId) {
  await api.delete(`/users/${userId}/follow/`);
}

export async function getFollowers(userId, { page = 1, pageSize = 20 } = {}) {
  const response = await api.get(`/users/${userId}/followers/`, {
    params: { page, page_size: pageSize },
  });
  return response.data;
}

export async function getFollowing(userId, { page = 1, pageSize = 20 } = {}) {
  const response = await api.get(`/users/${userId}/following/`, {
    params: { page, page_size: pageSize },
  });
  return response.data;
}
