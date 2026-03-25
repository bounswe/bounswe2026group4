from django.conf import settings
from django.db import models
from django.db.models import F
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver


class Comment(models.Model):
    """
    User comment on a story (req. 1.1.2.5).

    author is SET_NULL on user deletion so comments are anonymized, not deleted,
    consistent with the story anonymization policy (req. 1.1.2.11).
    is_anonymized flags rows that have had their author NULLed so the API can
    substitute "Deleted User" in responses without reading NULL as "no author yet".
    """

    story = models.ForeignKey(
        'stories.Story',
        on_delete=models.CASCADE,
        related_name='comments',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='comments',
    )
    text = models.TextField()
    is_anonymized = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'comments'
        indexes = [
            # Story page: all comments for a story sorted chronologically
            models.Index(fields=['story', 'created_at'], name='comment_story_date_idx'),
            models.Index(fields=['author'], name='comment_author_idx'),
        ]

    def __str__(self):
        return f'Comment({self.pk}) on Story({self.story_id})'


class Like(models.Model):
    """
    A user's like on a story (req. 1.1.2.4, 1.1.2.7).

    UniqueConstraint prevents duplicate likes at the database level.
    post_save / post_delete signals below keep Story.like_count in sync
    atomically using F() expressions — no race conditions under concurrent likes.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='likes',
    )
    story = models.ForeignKey(
        'stories.Story',
        on_delete=models.CASCADE,
        related_name='likes',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'likes'
        constraints = [
            models.UniqueConstraint(fields=['user', 'story'], name='unique_user_story_like'),
        ]
        indexes = [
            models.Index(fields=['story'], name='like_story_idx'),
        ]

    def __str__(self):
        return f'Like({self.user_id} → Story {self.story_id})'


class SavedStory(models.Model):
    """
    A story bookmarked by a user (req. 1.1.2.6, 1.2.2.5).

    UniqueConstraint prevents double-saves. post_save / post_delete signals
    keep Story.save_count in sync atomically.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_stories',
    )
    story = models.ForeignKey(
        'stories.Story',
        on_delete=models.CASCADE,
        related_name='saved_by',
    )
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'saved_stories'
        constraints = [
            models.UniqueConstraint(fields=['user', 'story'], name='unique_user_story_save'),
        ]
        indexes = [
            # Profile page: user's saved stories list
            models.Index(fields=['user', 'saved_at'], name='save_user_date_idx'),
            models.Index(fields=['story'], name='save_story_idx'),
        ]

    def __str__(self):
        return f'Save({self.user_id} → Story {self.story_id})'


# ── Signals: keep Story counter columns in sync ────────────────────────────────
# F() expressions make each UPDATE atomic at the DB level — safe under concurrent
# requests without row-level locking. Note: bulk QuerySet.delete() bypasses signals;
# document this constraint and add a reconciliation management command.

@receiver(post_save, sender=Like)
def on_like_created(sender, instance, created, **kwargs):
    if created:
        instance.story.__class__.objects.filter(pk=instance.story_id).update(
            like_count=F('like_count') + 1
        )


@receiver(post_delete, sender=Like)
def on_like_deleted(sender, instance, **kwargs):
    instance.story.__class__.objects.filter(pk=instance.story_id).update(
        like_count=F('like_count') - 1
    )


@receiver(post_save, sender=SavedStory)
def on_save_created(sender, instance, created, **kwargs):
    if created:
        instance.story.__class__.objects.filter(pk=instance.story_id).update(
            save_count=F('save_count') + 1
        )


@receiver(post_delete, sender=SavedStory)
def on_save_deleted(sender, instance, **kwargs):
    instance.story.__class__.objects.filter(pk=instance.story_id).update(
        save_count=F('save_count') - 1
    )
