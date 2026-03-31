import api from "./api";

export async function getProfile(userId) {
  const response = await api.get(`/users/${userId}/`);
  return response.data;
}
