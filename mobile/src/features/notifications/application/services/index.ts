import { NotificationRepositoryImpl } from '../../data/repositories';
import { NotificationPreferencesInput } from '../../domain/entities';

const repository = new NotificationRepositoryImpl();

export const notificationService = {
  async getNotifications(page = 1) {
    return repository.getNotifications(page);
  },

  async markAsRead(id: string) {
    return repository.markAsRead(id);
  },

  async markAllAsRead() {
    return repository.markAllAsRead();
  },

  async getPreferences() {
    return repository.getPreferences();
  },

  async updatePreferences(input: NotificationPreferencesInput) {
    return repository.updatePreferences(input);
  },
};

export const notificationsService = notificationService;
