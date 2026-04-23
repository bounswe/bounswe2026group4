from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.users.models import Follow


@receiver(post_save, sender=Follow)
def on_follow_created(sender, instance, created, **kwargs):
    if created:
        pass  # TODO: create NEW_FOLLOWER notification (Week 3)
