from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.notifications.models import NotificationType
from apps.users.models import Follow


@receiver(post_save, sender=Follow)
def on_follow_created(sender, instance, created, **kwargs):
    """Notify a user when someone starts following them."""
    if not created:
        return
    follower = instance.follower
    if follower.is_username_public:
        label, actor = follower.username, follower
    else:
        label, actor = 'Someone', None
    from apps.notifications.services import create_notification
    create_notification(
        recipient=instance.followed,
        notification_type=NotificationType.NEW_FOLLOWER,
        message=f'{label} started following you.',
        actor=actor,
    )
