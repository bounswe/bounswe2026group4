from django.db import IntegrityError, transaction
from django.http import Http404

from rest_framework.exceptions import ValidationError

from apps.gamification.constants import (
    STORY_COMMENT_REMOVED,
    STORY_COMMENTED,
    STORY_LIKE_REMOVED,
    STORY_LIKED,
    STORY_SAVE_REMOVED,
    STORY_SAVED,
    USER_COMMENT_REMOVED,
    USER_COMMENTED,
    USER_LIKE_REMOVED,
    USER_LIKED,
)
from apps.gamification.services import award_points
from apps.interactions.models import Comment, Like, SavedStory
from apps.stories.models import Story


def get_story_comments(story_id):
    """
    Return a queryset of comments for a published story, ordered oldest-first.

    select_related('author') avoids N+1 when the serializer reads author.username
    for each comment in the list.

    Raises Http404 if the story does not exist or is not published.
    """
    try:
        story = Story.objects.get(pk=story_id, status=Story.STATUS_PUBLISHED)
    except Story.DoesNotExist:
        raise Http404

    return (
        Comment.objects
        .filter(story=story)
        .select_related('author')
        .order_by('created_at')
    )


def create_comment(user, story_id, text):
    """
    Create and return a Comment on a published story.

    Raises Http404 if the story does not exist or is not published —
    removed stories should not accept new comments.
    """
    try:
        story = Story.objects.get(pk=story_id, status=Story.STATUS_PUBLISHED)
    except Story.DoesNotExist:
        raise Http404

    comment = Comment.objects.create(story=story, author=user, text=text)
    if story.user_id is not None:
        award_points(story.user, STORY_COMMENTED, story=story)
    award_points(user, USER_COMMENTED, story=story)
    return comment


def delete_comment(comment):
    """Delete a comment. Permission enforcement is the caller's responsibility."""
    story = comment.story
    author = comment.author  # capture before delete — author is SET_NULL on user deletion
    comment.delete()
    if story.user_id is not None:
        award_points(story.user, STORY_COMMENT_REMOVED, story=story)
    if author is not None:
        award_points(author, USER_COMMENT_REMOVED, story=story)


def add_like(user, story_id):
    """
    Create and return a Like for a published story.

    Raises Http404 if the story does not exist or is not published.
    Raises ValidationError if the user has already liked the story.
    """
    try:
        story = Story.objects.get(pk=story_id, status=Story.STATUS_PUBLISHED)
    except Story.DoesNotExist:
        raise Http404

    try:
        # transaction.atomic() creates a savepoint so an IntegrityError from the
        # unique constraint does not break the outer test/request transaction.
        with transaction.atomic():
            like = Like.objects.create(user=user, story=story)
    except IntegrityError:
        raise ValidationError({'detail': 'You have already liked this story.'})

    if story.user_id is not None:
        award_points(story.user, STORY_LIKED, story=story)
    award_points(user, USER_LIKED, story=story)
    return like


def remove_like(user, story_id):
    """
    Delete the Like for a published story.

    Raises Http404 if the story does not exist, is not published,
    or the user has not liked the story.
    """
    try:
        story = Story.objects.get(pk=story_id, status=Story.STATUS_PUBLISHED)
    except Story.DoesNotExist:
        raise Http404

    try:
        like = Like.objects.get(user=user, story=story)
    except Like.DoesNotExist:
        raise Http404

    like.delete()
    if story.user_id is not None:
        award_points(story.user, STORY_LIKE_REMOVED, story=story)
    award_points(user, USER_LIKE_REMOVED, story=story)


def add_bookmark(user, story_id):
    """
    Create and return a SavedStory for a published story.

    Raises Http404 if the story does not exist or is not published.
    Uses get_or_create (idempotent) — returns (bookmark, created).
    transaction.atomic() creates a savepoint so a MySQL UniqueConstraint
    IntegrityError does not break the outer transaction.
    """
    try:
        story = Story.objects.get(pk=story_id, status=Story.STATUS_PUBLISHED)
    except Story.DoesNotExist:
        raise Http404

    try:
        with transaction.atomic():
            bookmark, created = SavedStory.objects.get_or_create(user=user, story=story)
    except IntegrityError:
        bookmark = SavedStory.objects.get(user=user, story=story)
        created = False

    if created and story.user_id is not None:
        award_points(story.user, STORY_SAVED, story=story)
    return bookmark, created


def remove_bookmark(user, story_id):
    """
    Delete the SavedStory for a story if it exists.

    Raises Http404 only if the story does not exist at all.
    Idempotent — no exception if the user has not bookmarked the story.

    Status-agnostic by design: a user must be able to remove their own bookmark
    even after a story is removed or unpublished.

    Uses instance.delete() (not queryset .filter().delete()) so that the post_delete
    signal fires and Story.save_count is decremented atomically.
    """
    try:
        story = Story.objects.get(pk=story_id)
    except Story.DoesNotExist:
        raise Http404

    try:
        bookmark = SavedStory.objects.get(user=user, story=story)
        bookmark.delete()
        if story.user_id is not None:
            award_points(story.user, STORY_SAVE_REMOVED, story=story)
    except SavedStory.DoesNotExist:
        pass
