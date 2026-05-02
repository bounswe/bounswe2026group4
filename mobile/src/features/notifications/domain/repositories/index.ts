import {
  NotificationEntity,
  NotificationPreferencesEntity,
  NotificationPreferencesInput,
} from '../entities';

export interface NotificationRepository {
  getNotifications(page?: number): Promise<NotificationEntity[]>;
  markAsRead(id: string): Promise<NotificationEntity>;
  markAllAsRead(): Promise<NotificationEntity[]>;
  getPreferences(): Promise<NotificationPreferencesEntity>;
  updatePreferences(input: NotificationPreferencesInput): Promise<NotificationPreferencesEntity>;
}
