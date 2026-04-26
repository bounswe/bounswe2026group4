from apps.notifications.models import Notification, NotificationPreference


def is_notification_enabled(user, notification_type):
    """Return True if the user has not disabled this notification type.

    Absence of a preference row means the default (enabled) applies.
    """
    pref = NotificationPreference.objects.filter(
        user=user, notification_type=notification_type
    ).first()
    return pref.is_enabled if pref else True


def create_notification(recipient, notification_type, message, *, actor=None, story=None, comment=None):
    """Create and return a Notification, or None when the notification should be suppressed.

    Suppression rules:
    - recipient == actor: never self-notify (e.g. liking your own story).
    - recipient has disabled this notification type via NotificationPreference.
    """
    if actor is not None and recipient == actor:
        return None
    if not is_notification_enabled(recipient, notification_type):
        return None
    return Notification.objects.create(
        recipient=recipient,
        actor=actor,
        notification_type=notification_type,
        message=message,
        story=story,
        comment=comment,
    )


def get_notifications(user):
    """Return all notifications for the user, ordered by model default (unread first)."""
    return Notification.objects.filter(recipient=user).select_related('actor', 'story', 'comment')


def mark_notification_read(notification, is_read):
    """Set is_read on the notification and persist only that field."""
    notification.is_read = is_read
    notification.save(update_fields=['is_read'])
    return notification


def delete_notification(notification):
    """Delete a single notification."""
    notification.delete()


def delete_all_notifications(user):
    """Delete all notifications for a user (clear inbox)."""
    Notification.objects.filter(recipient=user).delete()
