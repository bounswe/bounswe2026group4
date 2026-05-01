import {
  NotificationActorEntity,
  NotificationEntity,
  NotificationPreferences,
  NotificationPreferencesEntity,
  NotificationType,
  notificationTypes,
} from '../../domain/entities';

const DEFAULT_MESSAGE_BY_TYPE: Record<NotificationType, string> = {
  new_comment: 'Someone commented on your story.',
  new_like: 'Someone liked your story.',
  moderation_action: 'There is a moderation update on your content.',
  story_removed: 'Your story was removed by moderation.',
  report_resolved: 'A report you submitted has been resolved.',
  badge_earned: 'You earned a new badge.',
};

const DEFAULT_PREFERENCES = notificationTypes.reduce((preferences, type) => {
  preferences[type] = true;
  return preferences;
}, {} as NotificationPreferences);

export function mapNotification(value: unknown): NotificationEntity {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid notification payload.');
  }

  const record = value as Record<string, unknown>;
  const type = asNotificationType(record.notification_type ?? record.type);
  const id = asString(record.id);
  const createdAt = asString(record.created_at ?? record.createdAt);

  if (!id || !createdAt) {
    throw new Error('Notification payload is missing required fields.');
  }

  return {
    id,
    type,
    message: asString(record.message) || DEFAULT_MESSAGE_BY_TYPE[type],
    actor: mapActor(record.actor),
    storyId: asOptionalString(record.story_id ?? record.storyId),
    commentId: asOptionalString(record.comment_id ?? record.commentId),
    isRead: Boolean(record.is_read ?? record.isRead),
    createdAt,
  };
}

export function mapNotifications(value: unknown): NotificationEntity[] {
  const rawNotifications =
    value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).notifications)
      ? (value as Record<string, unknown>).notifications
      : value;

  if (!Array.isArray(rawNotifications)) {
    return [];
  }

  return rawNotifications
    .map((notification) => {
      try {
        return mapNotification(notification);
      } catch {
        return null;
      }
    })
    .filter((notification): notification is NotificationEntity => notification != null)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function mapNotificationPreferences(value: unknown): NotificationPreferencesEntity {
  if (!value || typeof value !== 'object') {
    return {
      notificationsMuted: false,
      preferences: { ...DEFAULT_PREFERENCES },
    };
  }

  const record = value as Record<string, unknown>;
  const rawPreferences =
    record.preferences && typeof record.preferences === 'object'
      ? (record.preferences as Record<string, unknown>)
      : record;

  return {
    notificationsMuted: Boolean(record.notifications_muted ?? record.notificationsMuted),
    preferences: notificationTypes.reduce((preferences, type) => {
      preferences[type] =
        typeof rawPreferences[type] === 'boolean' ? Boolean(rawPreferences[type]) : DEFAULT_PREFERENCES[type];
      return preferences;
    }, {} as NotificationPreferences),
  };
}

function mapActor(value: unknown): NotificationActorEntity | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = asString(record.id);
  const username = asString(record.username);

  if (!id || !username) {
    return null;
  }

  return { id, username };
}

function asNotificationType(value: unknown): NotificationType {
  return notificationTypes.includes(value as NotificationType)
    ? (value as NotificationType)
    : 'moderation_action';
}

function asString(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return '';
}

function asOptionalString(value: unknown) {
  const resolved = asString(value);
  return resolved || undefined;
}
