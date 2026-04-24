"""Unit tests for interaction services."""
import pytest

from django.http import Http404
from rest_framework.exceptions import ValidationError

from apps.interactions.models import Comment, Like, SavedStory
from apps.interactions.services import (
    add_bookmark,
    add_like,
    create_comment,
    delete_comment,
    get_story_comments,
    remove_bookmark,
    remove_like,
)
from apps.stories.models import Story


@pytest.mark.django_db
class TestGetStoryComments:
    def test_returns_queryset_for_published_story(self, story):
        qs = get_story_comments(story.pk)
        assert qs is not None

    def test_returns_empty_queryset_when_no_comments(self, story):
        qs = get_story_comments(story.pk)
        assert qs.count() == 0

    def test_returns_comments_belonging_to_story(self, user, story):
        Comment.objects.create(story=story, author=user, text='Hello')
        qs = get_story_comments(story.pk)
        assert qs.count() == 1

    def test_ordered_oldest_first(self, user, story):
        c1 = Comment.objects.create(story=story, author=user, text='First')
        c2 = Comment.objects.create(story=story, author=user, text='Second')
        ids = list(get_story_comments(story.pk).values_list('pk', flat=True))
        assert ids == [c1.pk, c2.pk]

    def test_nonexistent_story_raises_404(self):
        with pytest.raises(Http404):
            get_story_comments(99999)

    def test_removed_story_raises_404(self, story):
        story.status = Story.STATUS_REMOVED
        story.save()
        with pytest.raises(Http404):
            get_story_comments(story.pk)

    def test_draft_story_raises_404(self, story):
        story.status = Story.STATUS_DRAFT
        story.save()
        with pytest.raises(Http404):
            get_story_comments(story.pk)

    def test_does_not_return_comments_from_other_stories(self, user, story, second_user):
        from decimal import Decimal
        other_story = Story.objects.create(
            user=second_user,
            title='Other',
            narrative='N.',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('0'),
            location_lng=Decimal('0'),
            location_name='P',
            time_type=Story.TIME_EXACT,
            year=2000,
        )
        Comment.objects.create(story=other_story, author=second_user, text='Other')
        qs = get_story_comments(story.pk)
        assert qs.count() == 0


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


# ── add_like / remove_like ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAddLike:
    def test_creates_like(self, user, story):
        like = add_like(user, story.pk)
        assert Like.objects.filter(pk=like.pk).exists()

    def test_returns_like_instance(self, user, story):
        result = add_like(user, story.pk)
        assert isinstance(result, Like)

    def test_like_linked_to_correct_story(self, user, story):
        like = add_like(user, story.pk)
        assert like.story_id == story.pk

    def test_like_linked_to_correct_user(self, user, story):
        like = add_like(user, story.pk)
        assert like.user_id == user.pk

    def test_nonexistent_story_raises_404(self, user):
        with pytest.raises(Http404):
            add_like(user, 99999)

    def test_removed_story_raises_404(self, user, story):
        story.status = Story.STATUS_REMOVED
        story.save()
        with pytest.raises(Http404):
            add_like(user, story.pk)

    def test_duplicate_like_raises_validation_error(self, user, story):
        add_like(user, story.pk)
        with pytest.raises(ValidationError):
            add_like(user, story.pk)


@pytest.mark.django_db
class TestRemoveLike:
    def test_removes_like_from_db(self, user, story):
        Like.objects.create(user=user, story=story)
        remove_like(user, story.pk)
        assert not Like.objects.filter(user=user, story=story).exists()

    def test_not_liked_raises_404(self, user, story):
        with pytest.raises(Http404):
            remove_like(user, story.pk)

    def test_nonexistent_story_raises_404(self, user):
        with pytest.raises(Http404):
            remove_like(user, 99999)

    def test_removed_story_raises_404(self, user, story):
        story.status = Story.STATUS_REMOVED
        story.save()
        with pytest.raises(Http404):
            remove_like(user, story.pk)


# ── add_bookmark / remove_bookmark ───────────────────────────────────────────


@pytest.mark.django_db
class TestAddBookmark:
    def test_creates_saved_story(self, user, story):
        bookmark, created = add_bookmark(user, story.pk)
        assert created is True
        assert SavedStory.objects.filter(pk=bookmark.pk).exists()

    def test_returns_saved_story_instance(self, user, story):
        bookmark, created = add_bookmark(user, story.pk)
        assert isinstance(bookmark, SavedStory)

    def test_bookmark_linked_to_correct_story(self, user, story):
        bookmark, _ = add_bookmark(user, story.pk)
        assert bookmark.story_id == story.pk

    def test_bookmark_linked_to_correct_user(self, user, story):
        bookmark, _ = add_bookmark(user, story.pk)
        assert bookmark.user_id == user.pk

    def test_increments_save_count(self, user, story):
        add_bookmark(user, story.pk)
        story.refresh_from_db()
        assert story.save_count == 1

    def test_duplicate_returns_existing_not_created(self, user, story):
        b1, _ = add_bookmark(user, story.pk)
        b2, created = add_bookmark(user, story.pk)
        assert created is False
        assert b1.pk == b2.pk

    def test_duplicate_does_not_double_increment_save_count(self, user, story):
        add_bookmark(user, story.pk)
        add_bookmark(user, story.pk)
        story.refresh_from_db()
        assert story.save_count == 1

    def test_nonexistent_story_raises_404(self, user):
        with pytest.raises(Http404):
            add_bookmark(user, 99999)

    def test_removed_story_raises_404(self, user, story):
        story.status = Story.STATUS_REMOVED
        story.save()
        with pytest.raises(Http404):
            add_bookmark(user, story.pk)

    def test_draft_story_raises_404(self, user, story):
        story.status = Story.STATUS_DRAFT
        story.save()
        with pytest.raises(Http404):
            add_bookmark(user, story.pk)


@pytest.mark.django_db
class TestRemoveBookmark:
    def test_deletes_saved_story_row(self, user, story):
        SavedStory.objects.create(user=user, story=story)
        remove_bookmark(user, story.pk)
        assert not SavedStory.objects.filter(user=user, story=story).exists()

    def test_decrements_save_count(self, user, story):
        SavedStory.objects.create(user=user, story=story)
        story.save_count = 1
        story.save()
        remove_bookmark(user, story.pk)
        story.refresh_from_db()
        assert story.save_count == 0

    def test_not_bookmarked_is_noop(self, user, story):
        remove_bookmark(user, story.pk)  # must not raise

    def test_nonexistent_story_raises_404(self, user):
        with pytest.raises(Http404):
            remove_bookmark(user, 99999)

    def test_removed_story_raises_404(self, user, story):
        story.status = Story.STATUS_REMOVED
        story.save()
        with pytest.raises(Http404):
            remove_bookmark(user, story.pk)

    def test_draft_story_raises_404(self, user, story):
        story.status = Story.STATUS_DRAFT
        story.save()
        with pytest.raises(Http404):
            remove_bookmark(user, story.pk)
