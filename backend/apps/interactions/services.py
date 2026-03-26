from django.http import Http404

from apps.interactions.models import Comment
from apps.stories.models import Story


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
