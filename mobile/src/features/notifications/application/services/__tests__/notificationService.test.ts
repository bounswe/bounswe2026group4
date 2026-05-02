import { resetApiTransport, setApiTransport } from '../../../../../core/api/client';
import { notificationService } from '../index';

describe('notificationService', () => {
  const requests: Array<{ method: string; url?: string; data?: unknown }> = [];

  beforeEach(() => {
    requests.length = 0;
    setApiTransport(async (method, config) => {
      requests.push({ method, url: config.url, data: config.data });

      if (method === 'GET' && config.url?.startsWith('/notifications/?')) {
        return {
          status: 200,
          data: {
            notifications: [
              {
                id: 1,
                notification_type: 'new_like',
                message: 'Aylin liked your story.',
                actor: { id: 12, username: 'Aylin' },
                story_id: 44,
                comment_id: null,
                is_read: false,
                created_at: '2026-04-30T12:00:00Z',
              },
            ],
          } as never,
          config,
        };
      }

      if (method === 'PATCH' && config.url === '/notifications/1/read/') {
        return {
          status: 200,
          data: {
            id: 1,
            notification_type: 'new_like',
            message: 'Aylin liked your story.',
            actor: { id: 12, username: 'Aylin' },
            story_id: 44,
            comment_id: null,
            is_read: true,
            created_at: '2026-04-30T12:00:00Z',
          } as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/notifications/preferences/') {
        return {
          status: 200,
          data: {
            notifications_muted: false,
            preferences: {
              new_comment: true,
              new_like: false,
              moderation_action: true,
              story_removed: true,
              report_resolved: true,
              badge_earned: true,
            },
          } as never,
          config,
        };
      }

      if (method === 'PATCH' && config.url === '/notifications/preferences/') {
        return {
          status: 200,
          data: {
            notifications_muted: true,
            preferences: {
              new_comment: true,
              new_like: false,
              moderation_action: true,
              story_removed: true,
              report_resolved: true,
              badge_earned: true,
            },
          } as never,
          config,
        };
      }

      throw new Error(`Unexpected request ${method} ${config.url}`);
    });
  });

  afterEach(() => {
    resetApiTransport();
  });

  it('loads and maps notifications', async () => {
    const notifications = await notificationService.getNotifications(2);

    expect(requests[0]).toMatchObject({ method: 'GET', url: '/notifications/?page=2' });
    expect(notifications[0]).toMatchObject({
      id: '1',
      type: 'new_like',
      storyId: '44',
      isRead: false,
      actor: { id: '12', username: 'Aylin' },
    });
  });

  it('marks one notification as read', async () => {
    const notification = await notificationService.markAsRead('1');

    expect(requests[0]).toMatchObject({
      method: 'PATCH',
      url: '/notifications/1/read/',
      data: { is_read: true },
    });
    expect(notification.isRead).toBe(true);
  });

  it('marks all unread notifications as read', async () => {
    const notifications = await notificationService.markAllAsRead();

    expect(requests.map((request) => request.url)).toEqual([
      '/notifications/?page=1',
      '/notifications/1/read/',
    ]);
    expect(notifications.every((notification) => notification.isRead)).toBe(true);
  });

  it('loads and updates notification preferences', async () => {
    const preferences = await notificationService.getPreferences();
    const updatedPreferences = await notificationService.updatePreferences({
      notificationsMuted: true,
      new_like: false,
    });

    expect(preferences.preferences.new_like).toBe(false);
    expect(requests.at(-1)).toMatchObject({
      method: 'PATCH',
      url: '/notifications/preferences/',
      data: expect.objectContaining({
        notifications_muted: true,
        new_like: false,
      }),
    });
    expect(updatedPreferences.notificationsMuted).toBe(true);
  });
});
