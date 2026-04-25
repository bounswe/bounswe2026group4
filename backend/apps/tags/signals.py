from django.db.models import F
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.tags.models import StoryTag, Tag


@receiver(post_save, sender=StoryTag)
def increment_tag_story_count(sender, instance, created, **kwargs):
    """Increment story_count on the related Tag whenever a new StoryTag row is created."""
    if created:
        Tag.objects.filter(pk=instance.tag_id).update(story_count=F('story_count') + 1)


@receiver(post_delete, sender=StoryTag)
def decrement_tag_story_count(sender, instance, **kwargs):
    """Decrement story_count on the related Tag whenever a StoryTag row is deleted."""
    Tag.objects.filter(pk=instance.tag_id).update(story_count=F('story_count') - 1)
