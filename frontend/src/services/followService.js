import api from "./api";

/**
 * Follow/unfollow service.
 *
 * NOTE: The backend follow/unfollow API is not implemented yet (tracked in a
 * separate backend issue). The endpoint shapes below match the assumptions in
 * the frontend issue and must be reconfirmed when the backend lands.
 */

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
