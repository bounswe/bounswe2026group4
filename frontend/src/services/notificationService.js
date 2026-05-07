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
  const results = await Promise.allSettled(
    ids.map((id) => markAsRead(id, true))
  );
  const firstRejection = results.find((r) => r.status === "rejected");
  if (firstRejection) throw firstRejection.reason;
}

export async function getPreferences() {
  const response = await api.get("/notifications/preferences/");
  return response.data;
}

export async function updatePreferences(prefs) {
  const response = await api.patch("/notifications/preferences/", prefs);
  return response.data;
}
