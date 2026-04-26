from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.interactions.models import Comment, Like
from apps.notifications.models import NotificationType


@receiver(post_save, sender=Comment)
def on_comment_created(sender, instance, created, **kwargs):
    """Notify the story author when someone else comments on their story."""
    if not created:
        return
    story = instance.story
    # story.user is None when the author deleted their account — skip
    if not story.user or instance.author == story.user:
        return
    from apps.notifications.services import create_notification
    create_notification(
        recipient=story.user,
        notification_type=NotificationType.NEW_COMMENT,
        message=f'{instance.author.username} commented on your story "{story.title}".',
        actor=instance.author,
        story=story,
        comment=instance,
    )


@receiver(post_save, sender=Like)
def on_like_created(sender, instance, created, **kwargs):
    """Notify the story author when someone else likes their story."""
    if not created:
        return
    story = instance.story
    if not story.user or instance.user == story.user:
        return
    from apps.notifications.services import create_notification
    create_notification(
        recipient=story.user,
        notification_type=NotificationType.NEW_LIKE,
        message=f'{instance.user.username} liked your story "{story.title}".',
        actor=instance.user,
        story=story,
    )
