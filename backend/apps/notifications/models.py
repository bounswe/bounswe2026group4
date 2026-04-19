from django.conf import settings
from django.db import models


class NotificationType(models.TextChoices):
    NEW_COMMENT = 'new_comment', 'New Comment'
    NEW_LIKE = 'new_like', 'New Like'
    NEW_FOLLOWER = 'new_follower', 'New Follower'
    MODERATION_ACTION = 'moderation_action', 'Moderation Action'
    STORY_REMOVED = 'story_removed', 'Story Removed'
    REPORT_RESOLVED = 'report_resolved', 'Report Resolved'
    BADGE_EARNED = 'badge_earned', 'Badge Earned'


class Notification(models.Model):
    """
    In-platform notification delivered to a user (req. 1.6).

    Notifications are created synchronously via Django signals (defined in
    each triggering app's signals.py, connected in AppConfig.ready()).
    This keeps view logic clean and positions signal handlers for easy
    extraction to Celery tasks if async delivery is added later.

    actor, story, and comment are optional context references — SET_NULL
    on deletion so the notification record survives the referenced content.
    """

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='triggered_notifications',
    )
    notification_type = models.CharField(max_length=20, choices=NotificationType.choices)
    message = models.TextField()
    story = models.ForeignKey(
        'stories.Story',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications',
    )
    comment = models.ForeignKey(
        'interactions.Comment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications',
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        # Notification inbox: unread notifications first, then reverse chronological
        ordering = ['is_read', '-created_at']
        indexes = [
            # Fetch all unread notifications for a user efficiently
            models.Index(fields=['recipient', 'is_read', 'created_at'], name='notif_recipient_read_idx'),
        ]

    def __str__(self):
        return f'Notification({self.notification_type} → {self.recipient_id})'


class NotificationPreference(models.Model):
    """
    Per-user, per-type opt-in/out toggle (req. 1.6.2.3).

    One row per (user, notification_type) pair. Absence of a row for a type
    means the default (enabled) applies — create rows on demand when a user
    first changes a preference.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_preferences',
    )
    notification_type = models.CharField(max_length=20, choices=NotificationType.choices)
    is_enabled = models.BooleanField(default=True)

    class Meta:
        db_table = 'notification_preferences'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'notification_type'],
                name='unique_user_notification_type',
            ),
        ]

    def __str__(self):
        state = 'on' if self.is_enabled else 'off'
        return f'Pref({self.user_id} — {self.notification_type}: {state})'
