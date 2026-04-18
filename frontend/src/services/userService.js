import api from "./api";

export async function getProfile(userId) {
  const response = await api.get(`/users/${userId}/`);
  return response.data;
}

export async function updateCurrentUser({ profile = {}, userFields = {}, profilePhoto }) {
  if (profilePhoto) {
    const formData = new FormData();
    Object.entries(userFields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, typeof value === "boolean" ? String(value) : value);
      }
    });
    Object.entries(profile).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(`profile[${key}]`, typeof value === "boolean" ? String(value) : value);
      }
    });
    formData.append("profile[profile_photo]", profilePhoto);
    const response = await api.patch("/users/me/", formData);
    return response.data;
  }
  const response = await api.patch("/users/me/", { ...userFields, profile });
  return response.data;
}
