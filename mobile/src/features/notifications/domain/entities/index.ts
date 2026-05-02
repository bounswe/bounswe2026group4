export const notificationTypes = [
  'new_comment',
  'new_like',
  'moderation_action',
  'story_removed',
  'report_resolved',
  'badge_earned',
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export interface NotificationActorEntity {
  id: string;
  username: string;
}

export interface NotificationEntity {
  id: string;
  type: NotificationType;
  message: string;
  actor: NotificationActorEntity | null;
  storyId?: string;
  commentId?: string;
  isRead: boolean;
  createdAt: string;
}

export type NotificationPreferences = Record<NotificationType, boolean>;

export interface NotificationPreferencesEntity {
  notificationsMuted: boolean;
  preferences: NotificationPreferences;
}

export type NotificationPreferencesInput = Partial<NotificationPreferences> & {
  notificationsMuted?: boolean;
};
