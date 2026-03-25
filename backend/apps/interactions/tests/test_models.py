"""
Tests for Comment, Like, and SavedStory models.

The most critical tests are the signal tests: creating or deleting a Like /
SavedStory must atomically update Story.like_count / Story.save_count. We
verify this by calling story.refresh_from_db() after the operation and reading
the counter straight from MySQL — not from the cached Python object.
"""
from decimal import Decimal

import pytest

from django.db import IntegrityError, transaction

from apps.interactions.models import Comment, Like, SavedStory
from apps.stories.models import Story
from apps.users.models import User


def _make_story(user, title='T'):
    return Story.objects.create(
        user=user, title=title, narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='P', time_type=Story.TIME_EXACT, year=2000,
    )


@pytest.mark.django_db
class TestComment:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='commenter@example.com', username='commenter', password='Password1',
        )
        self.author = User.objects.create_user(
            email='author@example.com', username='author', password='Password1',
        )
        self.story = _make_story(self.author)

    def test_comment_can_be_created(self):
        c = Comment.objects.create(story=self.story, author=self.user, text='Great story!')
        assert c.pk is not None

    def test_is_anonymized_defaults_to_false(self):
        c = Comment.objects.create(story=self.story, author=self.user, text='Hi')
        assert c.is_anonymized is False

    def test_created_at_is_set_automatically(self):
        c = Comment.objects.create(story=self.story, author=self.user, text='Hi')
        assert c.created_at is not None

    def test_comment_appears_in_story_reverse_relation(self):
        Comment.objects.create(story=self.story, author=self.user, text='Hello')
        assert self.story.comments.count() == 1

    def test_comment_appears_in_user_reverse_relation(self):
        Comment.objects.create(story=self.story, author=self.user, text='Hello')
        assert self.user.comments.count() == 1

    def test_comment_deleted_when_story_is_deleted(self):
        c = Comment.objects.create(story=self.story, author=self.user, text='Hi')
        c_pk = c.pk
        self.story.delete()
        assert not Comment.objects.filter(pk=c_pk).exists()

    def test_author_becomes_null_when_user_is_deleted(self):
        # SET_NULL: the comment survives but is anonymised (req. 1.1.2.11)
        c = Comment.objects.create(story=self.story, author=self.user, text='Hi')
        c_pk = c.pk
        self.user.delete()
        assert Comment.objects.get(pk=c_pk).author is None

    def test_comment_row_survives_author_deletion(self):
        c = Comment.objects.create(story=self.story, author=self.user, text='Hi')
        c_pk = c.pk
        self.user.delete()
        assert Comment.objects.filter(pk=c_pk).exists()


@pytest.mark.django_db
class TestLike:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='liker@example.com', username='liker', password='Password1',
        )
        self.other = User.objects.create_user(
            email='other@example.com', username='other', password='Password1',
        )
        self.author = User.objects.create_user(
            email='author@example.com', username='author', password='Password1',
        )
        self.story = _make_story(self.author)

    def test_like_can_be_created(self):
        like = Like.objects.create(user=self.user, story=self.story)
        assert like.pk is not None

    def test_created_at_is_set_automatically(self):
        like = Like.objects.create(user=self.user, story=self.story)
        assert like.created_at is not None

    def test_duplicate_like_raises_integrity_error(self):
        Like.objects.create(user=self.user, story=self.story)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Like.objects.create(user=self.user, story=self.story)

    def test_different_users_can_like_same_story(self):
        Like.objects.create(user=self.user, story=self.story)
        Like.objects.create(user=self.other, story=self.story)
        assert Like.objects.filter(story=self.story).count() == 2

    def test_same_user_can_like_different_stories(self):
        story2 = _make_story(self.author, title='Story 2')
        Like.objects.create(user=self.user, story=self.story)
        Like.objects.create(user=self.user, story=story2)
        assert Like.objects.filter(user=self.user).count() == 2

    def test_like_deleted_when_user_is_deleted(self):
        like = Like.objects.create(user=self.user, story=self.story)
        like_pk = like.pk
        self.user.delete()
        assert not Like.objects.filter(pk=like_pk).exists()

    def test_like_deleted_when_story_is_deleted(self):
        like = Like.objects.create(user=self.user, story=self.story)
        like_pk = like.pk
        self.story.delete()
        assert not Like.objects.filter(pk=like_pk).exists()

    # ── Signal tests ──────────────────────────────────────────────────────────

    def test_like_count_increments_when_like_is_created(self):
        Like.objects.create(user=self.user, story=self.story)
        self.story.refresh_from_db()
        assert self.story.like_count == 1

    def test_like_count_increments_for_each_new_like(self):
        Like.objects.create(user=self.user, story=self.story)
        Like.objects.create(user=self.other, story=self.story)
        self.story.refresh_from_db()
        assert self.story.like_count == 2

    def test_like_count_decrements_when_like_is_deleted(self):
        like = Like.objects.create(user=self.user, story=self.story)
        like.delete()
        self.story.refresh_from_db()
        assert self.story.like_count == 0

    def test_like_count_returns_to_zero_after_all_likes_removed(self):
        like1 = Like.objects.create(user=self.user, story=self.story)
        like2 = Like.objects.create(user=self.other, story=self.story)
        like1.delete()
        like2.delete()
        self.story.refresh_from_db()
        assert self.story.like_count == 0


@pytest.mark.django_db
class TestSavedStory:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='saver@example.com', username='saver', password='Password1',
        )
        self.other = User.objects.create_user(
            email='saver2@example.com', username='saver2', password='Password1',
        )
        self.author = User.objects.create_user(
            email='author@example.com', username='author', password='Password1',
        )
        self.story = _make_story(self.author)

    def test_saved_story_can_be_created(self):
        save = SavedStory.objects.create(user=self.user, story=self.story)
        assert save.pk is not None

    def test_saved_at_is_set_automatically(self):
        save = SavedStory.objects.create(user=self.user, story=self.story)
        assert save.saved_at is not None

    def test_duplicate_save_raises_integrity_error(self):
        SavedStory.objects.create(user=self.user, story=self.story)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                SavedStory.objects.create(user=self.user, story=self.story)

    def test_different_users_can_save_same_story(self):
        SavedStory.objects.create(user=self.user, story=self.story)
        SavedStory.objects.create(user=self.other, story=self.story)
        assert SavedStory.objects.filter(story=self.story).count() == 2

    def test_save_deleted_when_user_is_deleted(self):
        save = SavedStory.objects.create(user=self.user, story=self.story)
        save_pk = save.pk
        self.user.delete()
        assert not SavedStory.objects.filter(pk=save_pk).exists()

    def test_save_deleted_when_story_is_deleted(self):
        save = SavedStory.objects.create(user=self.user, story=self.story)
        save_pk = save.pk
        self.story.delete()
        assert not SavedStory.objects.filter(pk=save_pk).exists()

    def test_user_saved_stories_accessible_via_reverse_relation(self):
        SavedStory.objects.create(user=self.user, story=self.story)
        assert self.user.saved_stories.count() == 1

    # ── Signal tests ──────────────────────────────────────────────────────────

    def test_save_count_increments_when_story_is_saved(self):
        SavedStory.objects.create(user=self.user, story=self.story)
        self.story.refresh_from_db()
        assert self.story.save_count == 1

    def test_save_count_increments_for_each_save(self):
        SavedStory.objects.create(user=self.user, story=self.story)
        SavedStory.objects.create(user=self.other, story=self.story)
        self.story.refresh_from_db()
        assert self.story.save_count == 2

    def test_save_count_decrements_when_save_is_removed(self):
        save = SavedStory.objects.create(user=self.user, story=self.story)
        save.delete()
        self.story.refresh_from_db()
        assert self.story.save_count == 0

    def test_save_count_returns_to_zero_after_all_saves_removed(self):
        save1 = SavedStory.objects.create(user=self.user, story=self.story)
        save2 = SavedStory.objects.create(user=self.other, story=self.story)
        save1.delete()
        save2.delete()
        self.story.refresh_from_db()
        assert self.story.save_count == 0
