from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.notifications.models import NotificationType
from apps.stories.models import Story
from apps.users.models import Follow


@receiver(pre_save, sender=Story)
def on_story_removed(sender, instance, **kwargs):
    """Notify the story author when their story is removed by moderation.

    Uses pre_save so we can read the old status from the DB before the change
    commits. Guards against duplicate notifications when the status is already
    'removed' (e.g. a second save on the same story).
    """
    if instance.pk is None or not instance.user:
        return
    if instance.status != Story.STATUS_REMOVED:
        return
    try:
        old_status = Story.objects.values_list('status', flat=True).get(pk=instance.pk)
    except Story.DoesNotExist:
        return
    if old_status == Story.STATUS_REMOVED:
        return
    from apps.notifications.services import create_notification
    create_notification(
        recipient=instance.user,
        notification_type=NotificationType.STORY_REMOVED,
        message=f'Your story "{instance.title}" has been removed by a moderator.',
        story=instance,
    )


@receiver(post_save, sender=Story)
def on_story_published(sender, instance, created, **kwargs):
    """Notify all followers of the author when a new published story is created.

    Only fires on creation (not updates) and only for published stories, so draft
    submissions and status-only edits are ignored.
    TODO: for authors with large follower counts this runs synchronously — extract
    to a Celery task before launch.
    """
    if not created or instance.status != Story.STATUS_PUBLISHED or not instance.user:
        return
    follows = Follow.objects.filter(followed=instance.user).select_related('follower')
    from apps.notifications.services import create_notification
    for follow in follows:
        create_notification(
            recipient=follow.follower,
            notification_type=NotificationType.NEW_STORY_PUBLISHED,
            message=f'{instance.user.username} published a new story: "{instance.title}".',
            actor=instance.user,
            story=instance,
        )
