import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, ErrorState, Loader } from '../../../../shared';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { useToast } from '../../../../shared/hooks/useToast';
import { notificationService } from '../../application/services';
import { NotificationEntity } from '../../domain/entities';
import { NotificationCard } from '../components/NotificationCard';

interface NotificationScreenProps {
  getNotifications?: typeof notificationService.getNotifications;
  markAsRead?: typeof notificationService.markAsRead;
  markAllAsRead?: typeof notificationService.markAllAsRead;
  onOpenStory?: (storyId: string) => void;
  onOpenProfile?: () => void;
  onNotificationsChanged?: (notifications: NotificationEntity[]) => void;
}

export function NotificationScreen({
  getNotifications = notificationService.getNotifications,
  markAsRead = notificationService.markAsRead,
  markAllAsRead = notificationService.markAllAsRead,
  onOpenStory,
  onOpenProfile,
  onNotificationsChanged,
}: NotificationScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<NotificationEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState<string>();

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );
  const sortedNotifications = useMemo(
    () => [...notifications].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [notifications],
  );

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const result = await getNotifications(1);
      setNotifications(result);
      onNotificationsChanged?.(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.');
    } finally {
      setIsLoading(false);
    }
  }, [getNotifications, onNotificationsChanged]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const handleNotificationPress = async (notification: NotificationEntity) => {
    if (!notification.isRead) {
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
      );

      try {
        const updatedNotification = await markAsRead(notification.id);
        setNotifications((current) => {
          const next = current.map((item) => (item.id === notification.id ? updatedNotification : item));
          onNotificationsChanged?.(next);
          return next;
        });
      } catch {
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, isRead: false } : item)),
        );
        toast.error('Unable to mark notification as read.');
        return;
      }
    }

    if (notification.storyId) {
      onOpenStory?.(notification.storyId);
      return;
    }

    onOpenProfile?.();
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true);

    try {
      const updatedNotifications = await markAllAsRead();
      setNotifications(updatedNotifications);
      onNotificationsChanged?.(updatedNotifications);
      toast.success('All notifications marked as read.');
    } catch (markError) {
      toast.error(markError instanceof Error ? markError.message : 'Unable to mark notifications as read.');
    } finally {
      setIsMarkingAll(false);
    }
  };

  if (isLoading) {
    return <Loader message="Loading notifications..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Notifications unavailable"
        message={error}
        retryLabel="Try again"
        onRetry={() => void loadNotifications()}
      />
    );
  }

  return (
    <View style={{ flex: 1, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
            {unreadCount ? `${unreadCount} unread` : 'All caught up'}
          </Text>
          <Text style={{ marginTop: spacing.xs, color: colors.muted }}>
            Notifications are ordered newest first.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark all notifications as read"
          disabled={unreadCount === 0 || isMarkingAll}
          onPress={() => void handleMarkAllAsRead()}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: unreadCount === 0 || isMarkingAll ? 0.45 : pressed ? 0.75 : 1,
          })}
        >
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {isMarkingAll ? 'Saving...' : 'Mark all as read'}
          </Text>
        </Pressable>
      </View>

      {sortedNotifications.length === 0 ? (
        <View
          style={{
            padding: spacing.lg,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            gap: spacing.sm,
          }}
        >
          <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
            No notifications yet
          </Text>
          <Text style={{ color: colors.muted }}>
            Comments, likes, moderation updates, reports, and badges will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }} showsVerticalScrollIndicator={false}>
          {sortedNotifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onPress={(selectedNotification) => void handleNotificationPress(selectedNotification)}
            />
          ))}
        </ScrollView>
      )}

      {sortedNotifications.length > 0 ? (
        <Button variant="outline" onPress={() => void loadNotifications()}>
          Refresh
        </Button>
      ) : null}
    </View>
  );
}
