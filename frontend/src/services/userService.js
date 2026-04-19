import api from "./api";

export async function getProfile(userId) {
  const response = await api.get(`/users/${userId}/`);
  return response.data;
}

export async function updateCurrentUser({ profile = {}, userFields = {}, profilePhoto }) {
  const response = await api.patch("/users/me/", { ...userFields, profile });
  if (profilePhoto) {
    const formData = new FormData();
    formData.append("photo", profilePhoto);
    await api.post("/users/me/photo/", formData);
  }
  return response.data;
}
