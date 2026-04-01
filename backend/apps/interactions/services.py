from django.db import IntegrityError, transaction
from django.http import Http404

from rest_framework.exceptions import ValidationError

from apps.interactions.models import Comment, Like
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

    return Comment.objects.create(story=story, author=user, text=text)


def delete_comment(comment):
    """Delete a comment. Permission enforcement is the caller's responsibility."""
    comment.delete()


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
            return Like.objects.create(user=user, story=story)
    except IntegrityError:
        raise ValidationError({'detail': 'You have already liked this story.'})


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
