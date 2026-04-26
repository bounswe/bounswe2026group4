from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.gamification.models import UserBadge
from apps.notifications.models import NotificationType


@receiver(post_save, sender=UserBadge)
def on_badge_earned(sender, instance, created, **kwargs):
    """Notify a user when they are awarded a new badge."""
    if not created:
        return
    from apps.notifications.services import create_notification
    create_notification(
        recipient=instance.user,
        notification_type=NotificationType.BADGE_EARNED,
        message=f'You earned the "{instance.badge.name}" badge!',
    )
