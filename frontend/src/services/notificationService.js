import api from "./api";

export async function getNotifications() {
  const response = await api.get("/notifications/");
  return response.data;
}

export async function markAsRead(id, isRead = true) {
  const response = await api.patch(`/notifications/${id}/read/`, { is_read: isRead });
  return response.data;
}

export async function markAllAsRead(ids) {
  await Promise.all(ids.map((id) => markAsRead(id, true)));
}

export async function getPreferences() {
  const response = await api.get("/notifications/preferences/");
  return response.data;
}

export async function updatePreferences(prefs) {
  const response = await api.patch("/notifications/preferences/", prefs);
  return response.data;
}
