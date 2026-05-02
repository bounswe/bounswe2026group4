import React from 'react';
import { MessageCircle, ShieldAlert, Star, ThumbsUp, Trash2, Trophy } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { NotificationEntity, NotificationType } from '../../domain/entities';

const LABEL_BY_TYPE: Record<NotificationType, string> = {
  new_comment: 'Comment',
  new_like: 'Like',
  moderation_action: 'Moderation',
  story_removed: 'Removed story',
  report_resolved: 'Report update',
  badge_earned: 'Badge',
};

export const NOTIFICATION_TYPE_LABELS = LABEL_BY_TYPE;

export function NotificationCard({
  notification,
  onPress,
}: {
  notification: NotificationEntity;
  onPress: (notification: NotificationEntity) => void;
}) {
  const { colors, spacing, typography } = useAppTheme();
  const iconColor = notification.isRead ? colors.muted : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${notification.isRead ? 'Read' : 'Unread'} notification: ${notification.message}`}
      onPress={() => onPress(notification)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: notification.isRead ? colors.border : colors.primary,
        backgroundColor: notification.isRead ? colors.surface : colors.infoSurface,
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <NotificationTypeIcon type={notification.type} color={iconColor} />
      </View>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <Text style={{ color: iconColor, fontSize: typography.caption, fontWeight: '800', textTransform: 'uppercase' }}>
            {LABEL_BY_TYPE[notification.type]}
          </Text>
          {!notification.isRead ? (
            <View
              accessibilityLabel="Unread"
              style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: colors.primary }}
            />
          ) : null}
        </View>
        <Text style={{ color: colors.text, fontWeight: notification.isRead ? '500' : '800' }}>
          {notification.message}
        </Text>
        <Text style={{ color: colors.muted, fontSize: typography.caption + 1 }}>
          {formatRelativeTime(notification.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

function NotificationTypeIcon({ type, color }: { type: NotificationType; color: string }) {
  const iconProps = { color, size: 20, strokeWidth: 2.25 };

  switch (type) {
    case 'new_comment':
      return <MessageCircle {...iconProps} />;
    case 'new_like':
      return <ThumbsUp {...iconProps} />;
    case 'moderation_action':
      return <ShieldAlert {...iconProps} />;
    case 'story_removed':
      return <Trash2 {...iconProps} />;
    case 'report_resolved':
      return <Star {...iconProps} />;
    case 'badge_earned':
      return <Trophy {...iconProps} />;
    default:
      return <Star {...iconProps} />;
  }
}

export function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return 'Recently';
  }

  const diffSeconds = Math.max(Math.floor((Date.now() - timestamp) / 1000), 0);

  if (diffSeconds < 60) {
    return 'Just now';
  }

  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }

  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
