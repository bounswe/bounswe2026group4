"""Unit tests for comment services."""
import pytest

from django.http import Http404

from apps.interactions.models import Comment
from apps.interactions.services import create_comment, delete_comment
from apps.stories.models import Story


@pytest.mark.django_db
class TestCreateComment:
    def test_create_comment_on_published_story(self, user, story):
        comment = create_comment(user, story.pk, 'Great story!')
        assert comment.pk is not None
        assert comment.author == user
        assert comment.story == story
        assert comment.text == 'Great story!'

    def test_create_comment_on_removed_story_raises_404(self, user, story):
        story.status = Story.STATUS_REMOVED
        story.save()
        with pytest.raises(Http404):
            create_comment(user, story.pk, 'text')

    def test_create_comment_on_nonexistent_story_raises_404(self, user):
        with pytest.raises(Http404):
            create_comment(user, 99999, 'text')

    def test_create_comment_persists_to_db(self, user, story):
        create_comment(user, story.pk, 'Saved?')
        assert Comment.objects.filter(story=story, author=user).exists()


@pytest.mark.django_db
class TestDeleteComment:
    def test_delete_comment_removes_from_db(self, user, story):
        comment = Comment.objects.create(story=story, author=user, text='Bye')
        pk = comment.pk
        delete_comment(comment)
        assert not Comment.objects.filter(pk=pk).exists()
