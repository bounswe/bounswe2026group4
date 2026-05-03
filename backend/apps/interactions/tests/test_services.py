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
from apps.users.models import User


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

    def test_create_comment_awards_points_to_story_author(self, story, second_user):
        create_comment(second_user, story.pk, 'Nice!')
        story.user.refresh_from_db()
        assert story.user.total_points == 4

    def test_create_comment_awards_points_to_commenter(self, story, second_user):
        create_comment(second_user, story.pk, 'Nice!')
        second_user.refresh_from_db()
        assert second_user.total_points == 2

    def test_create_comment_skips_points_when_story_has_no_author(self, story, second_user):
        story.user = None
        story.save()
        create_comment(second_user, story.pk, 'Nice!')  # must not raise

    def test_create_comment_commenter_still_gets_points_when_story_has_no_author(self, story, second_user):
        story.user = None
        story.save()
        create_comment(second_user, story.pk, 'Nice!')
        second_user.refresh_from_db()
        assert second_user.total_points == 2


@pytest.mark.django_db
class TestDeleteComment:
    def test_delete_comment_removes_from_db(self, user, story):
        comment = Comment.objects.create(story=story, author=user, text='Bye')
        pk = comment.pk
        delete_comment(comment)
        assert not Comment.objects.filter(pk=pk).exists()

    def test_delete_comment_deducts_points_from_story_author(self, user, story):
        comment = Comment.objects.create(story=story, author=user, text='Bye')
        user.total_points = 4
        user.save()
        delete_comment(comment)
        user.refresh_from_db()
        assert user.total_points == 0

    def test_delete_comment_deducts_points_from_commenter(self, story, second_user):
        comment = Comment.objects.create(story=story, author=second_user, text='Bye')
        second_user.total_points = 2
        second_user.save()
        delete_comment(comment)
        second_user.refresh_from_db()
        assert second_user.total_points == 0

    def test_delete_comment_skips_points_when_story_has_no_author(self, user, story):
        story.user = None
        story.save()
        comment = Comment.objects.create(story=story, author=user, text='Bye')
        delete_comment(comment)  # must not raise

    def test_delete_comment_commenter_still_loses_points_when_story_has_no_author(self, story, second_user):
        story.user = None
        story.save()
        comment = Comment.objects.create(story=story, author=second_user, text='Bye')
        second_user.total_points = 2
        second_user.save()
        delete_comment(comment)
        second_user.refresh_from_db()
        assert second_user.total_points == 0

    def test_delete_comment_skips_commenter_deduction_when_author_is_anonymous(self, user, story):
        # comment.author is None when the commenter's account was deleted (SET_NULL)
        comment = Comment.objects.create(story=story, author=None, text='Bye', is_anonymized=True)
        delete_comment(comment)  # must not raise


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

    def test_add_like_awards_points_to_story_author(self, story, second_user):
        add_like(second_user, story.pk)
        story.user.refresh_from_db()
        assert story.user.total_points == 2

    def test_add_like_awards_points_to_liker(self, story, second_user):
        add_like(second_user, story.pk)
        second_user.refresh_from_db()
        assert second_user.total_points == 1

    def test_add_like_skips_points_when_story_has_no_author(self, story, second_user):
        story.user = None
        story.save()
        add_like(second_user, story.pk)  # must not raise

    def test_add_like_liker_still_gets_points_when_story_has_no_author(self, story, second_user):
        story.user = None
        story.save()
        add_like(second_user, story.pk)
        second_user.refresh_from_db()
        assert second_user.total_points == 1


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

    def test_remove_like_deducts_points_from_story_author(self, story, second_user):
        Like.objects.create(user=second_user, story=story)
        story.user.total_points = 10
        story.user.save()
        remove_like(second_user, story.pk)
        story.user.refresh_from_db()
        assert story.user.total_points == 8

    def test_remove_like_deducts_points_from_liker(self, story, second_user):
        Like.objects.create(user=second_user, story=story)
        second_user.total_points = 5
        second_user.save()
        remove_like(second_user, story.pk)
        second_user.refresh_from_db()
        assert second_user.total_points == 4

    def test_remove_like_skips_points_when_story_has_no_author(self, story, second_user):
        Like.objects.create(user=second_user, story=story)
        story.user = None
        story.save()
        remove_like(second_user, story.pk)  # must not raise

    def test_remove_like_liker_still_loses_points_when_story_has_no_author(self, story, second_user):
        Like.objects.create(user=second_user, story=story)
        second_user.total_points = 5
        second_user.save()
        story.user = None
        story.save()
        remove_like(second_user, story.pk)
        second_user.refresh_from_db()
        assert second_user.total_points == 4


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

    def test_add_bookmark_awards_points_to_story_author(self, story, second_user):
        add_bookmark(second_user, story.pk)
        story.user.refresh_from_db()
        assert story.user.total_points == 3

    def test_add_bookmark_duplicate_does_not_award_points_again(self, story, second_user):
        add_bookmark(second_user, story.pk)
        add_bookmark(second_user, story.pk)  # idempotent — no second award
        story.user.refresh_from_db()
        assert story.user.total_points == 3

    def test_add_bookmark_skips_points_when_story_has_no_author(self, story, second_user):
        story.user = None
        story.save()
        add_bookmark(second_user, story.pk)  # must not raise


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

    def test_removed_story_can_be_unbookmarked(self, user, story):
        SavedStory.objects.create(user=user, story=story)
        story.status = Story.STATUS_REMOVED
        story.save()
        remove_bookmark(user, story.pk)  # must not raise
        assert not SavedStory.objects.filter(user=user, story=story).exists()

    def test_draft_story_can_be_unbookmarked(self, user, story):
        SavedStory.objects.create(user=user, story=story)
        story.status = Story.STATUS_DRAFT
        story.save()
        remove_bookmark(user, story.pk)  # must not raise
        assert not SavedStory.objects.filter(user=user, story=story).exists()

    def test_remove_bookmark_deducts_points_from_story_author(self, story, second_user):
        SavedStory.objects.create(user=second_user, story=story)
        story.user.total_points = 10
        story.user.save()
        remove_bookmark(second_user, story.pk)
        story.user.refresh_from_db()
        assert story.user.total_points == 7

    def test_remove_bookmark_does_not_deduct_when_not_bookmarked(self, story, second_user):
        story.user.total_points = 10
        story.user.save()
        remove_bookmark(second_user, story.pk)  # nothing to delete
        story.user.refresh_from_db()
        assert story.user.total_points == 10

    def test_remove_bookmark_skips_points_when_story_has_no_author(self, story, second_user):
        SavedStory.objects.create(user=second_user, story=story)
        story.user = None
        story.save()
        remove_bookmark(second_user, story.pk)  # must not raise
