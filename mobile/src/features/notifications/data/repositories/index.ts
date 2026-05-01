import { NotificationRepository } from '../../domain/repositories';
import { NotificationPreferencesInput } from '../../domain/entities';
import {
  mapNotification,
  mapNotificationPreferences,
  mapNotifications,
} from '../mappers';
import { notificationsRemoteSource } from '../sources';

export class NotificationRepositoryImpl implements NotificationRepository {
  async getNotifications(page = 1) {
    const response = await notificationsRemoteSource.getNotifications(page);
    return mapNotifications(response);
  }

  async markAsRead(id: string) {
    const response = await notificationsRemoteSource.markAsRead(id);
    return mapNotification(response);
  }

  async markAllAsRead() {
    const notifications = await this.getNotifications();
    const unreadNotifications = notifications.filter((notification) => !notification.isRead);

    await Promise.all(unreadNotifications.map((notification) => notificationsRemoteSource.markAsRead(notification.id)));

    return notifications.map((notification) => ({ ...notification, isRead: true }));
  }

  async getPreferences() {
    const response = await notificationsRemoteSource.getPreferences();
    return mapNotificationPreferences(response);
  }

  async updatePreferences(input: NotificationPreferencesInput) {
    const response = await notificationsRemoteSource.updatePreferences(input);
    return mapNotificationPreferences(response);
  }
}
