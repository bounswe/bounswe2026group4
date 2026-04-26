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
    # Both story.user and instance.author can be None when an account was deleted — skip.
    if not story.user or not instance.author or instance.author == story.user:
        return
    # Don't expose the commenter's identity if they've set their username to private.
    # actor is also withheld so the serializer cannot leak the user object.
    author = instance.author
    if author.is_username_public:
        label, actor = author.username, author
    else:
        label, actor = 'Someone', None
    from apps.notifications.services import create_notification
    create_notification(
        recipient=story.user,
        notification_type=NotificationType.NEW_COMMENT,
        message=f'{label} commented on your story "{story.title}".',
        actor=actor,
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
    liker = instance.user
    if liker.is_username_public:
        label, actor = liker.username, liker
    else:
        label, actor = 'Someone', None
    from apps.notifications.services import create_notification
    create_notification(
        recipient=story.user,
        notification_type=NotificationType.NEW_LIKE,
        message=f'{label} liked your story "{story.title}".',
        actor=actor,
        story=story,
    )
