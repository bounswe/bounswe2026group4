import { apiClient } from '../../../../core/api/client';
import { endpoints } from '../../../../core/api/endpoints';
import { NotificationPreferencesInput } from '../../domain/entities';

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const query = searchParams.toString();

  return query ? `?${query}` : '';
}

function normalizePreferencesPayload(input: NotificationPreferencesInput) {
  return {
    ...input,
    notifications_muted: input.notificationsMuted,
    notificationsMuted: undefined,
  };
}

export const notificationsRemoteSource = {
  async getNotifications(page = 1) {
    return apiClient.get<unknown>(`${endpoints.notifications}/${buildQueryString({ page })}`);
  },

  async markAsRead(id: string) {
    return apiClient.patch<unknown>(`${endpoints.notifications}/${id}/read/`, { is_read: true });
  },

  async getPreferences() {
    return apiClient.get<unknown>(`${endpoints.notifications}/preferences/`);
  },

  async updatePreferences(input: NotificationPreferencesInput) {
    return apiClient.patch<unknown>(
      `${endpoints.notifications}/preferences/`,
      normalizePreferencesPayload(input),
    );
  },
};

export const notificationsLocalSource = {};
