"""Unit tests for interaction serializers."""
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from apps.interactions.models import Comment, Like
from apps.interactions.serializers import (
    CommentCreateSerializer,
    CommentResponseSerializer,
    LikeResponseSerializer,
)
from apps.stories.models import Story
from apps.users.models import User


class TestCommentCreateSerializer:
    def test_create_serializer_valid(self):
        s = CommentCreateSerializer(data={'text': 'Hello!'})
        assert s.is_valid()
        assert s.validated_data['text'] == 'Hello!'

    def test_create_serializer_blank_text_fails(self):
        s = CommentCreateSerializer(data={'text': ''})
        assert not s.is_valid()
        assert 'text' in s.errors

    def test_create_serializer_missing_text_fails(self):
        s = CommentCreateSerializer(data={})
        assert not s.is_valid()
        assert 'text' in s.errors

    def test_create_serializer_whitespace_only_text_fails(self):
        # DRF CharField strips whitespace before the blank check,
        # so an all-whitespace string is treated as blank and rejected.
        s = CommentCreateSerializer(data={'text': '   '})
        assert not s.is_valid()
        assert 'text' in s.errors


@pytest.mark.django_db
class TestCommentResponseSerializer:
    def test_response_serializer_with_author(self, user, story):
        comment = Comment.objects.create(story=story, author=user, text='Great!')
        data = CommentResponseSerializer(comment).data
        assert data['author_username'] == user.username
        assert data['is_anonymized'] is False
        assert data['text'] == 'Great!'
        assert data['story_id'] == story.pk

    def test_response_serializer_anonymized(self, user, story):
        # Simulate a comment that was anonymized after account deletion
        comment = Comment.objects.create(story=story, author=None, text='Old comment', is_anonymized=True)
        data = CommentResponseSerializer(comment).data
        assert data['author_username'] is None
        assert data['is_anonymized'] is True

    def test_response_serializer_includes_required_fields(self, user, story):
        comment = Comment.objects.create(story=story, author=user, text='Hi')
        data = CommentResponseSerializer(comment).data
        for field in ['id', 'story_id', 'author_username', 'text', 'is_anonymized', 'created_at', 'is_own_comment']:
            assert field in data

    def test_response_serializer_hides_username_when_private(self, story):
        private_user = User.objects.create_user(
            email='private@example.com', username='privateuser', password='Password1',
            is_username_public=False, is_active=True,
        )
        comment = Comment.objects.create(story=story, author=private_user, text='Incognito')
        data = CommentResponseSerializer(comment).data
        assert data['author_username'] is None
        assert data['is_anonymized'] is False

    def test_response_serializer_shows_username_when_public(self, story):
        public_user = User.objects.create_user(
            email='public@example.com', username='publicuser', password='Password1',
            is_username_public=True, is_active=True,
        )
        comment = Comment.objects.create(story=story, author=public_user, text='Visible')
        data = CommentResponseSerializer(comment).data
        assert data['author_username'] == 'publicuser'

    def test_get_is_own_comment_returns_true_for_author(self, user, story):
        comment = Comment.objects.create(story=story, author=user, text='Mine')
        request = MagicMock()
        request.user = user  # is_authenticated is a property that returns True for active users
        data = CommentResponseSerializer(comment, context={'request': request}).data
        assert data['is_own_comment'] is True

    def test_get_is_own_comment_returns_false_for_other_user(self, user, story):
        other = User.objects.create_user(
            email='other_ser@example.com', username='otherser', password='Password1', is_active=True,
        )
        comment = Comment.objects.create(story=story, author=user, text='Not yours')
        request = MagicMock()
        request.user = other
        data = CommentResponseSerializer(comment, context={'request': request}).data
        assert data['is_own_comment'] is False

    def test_get_is_own_comment_returns_false_when_no_request_context(self, user, story):
        comment = Comment.objects.create(story=story, author=user, text='No ctx')
        data = CommentResponseSerializer(comment).data
        assert data['is_own_comment'] is False

    def test_get_is_own_comment_returns_false_for_unauthenticated(self, user, story):
        from django.contrib.auth.models import AnonymousUser
        comment = Comment.objects.create(story=story, author=user, text='Anon viewer')
        request = MagicMock()
        request.user = AnonymousUser()
        data = CommentResponseSerializer(comment, context={'request': request}).data
        assert data['is_own_comment'] is False

    def test_get_is_own_comment_true_when_author_username_is_null(self, story):
        # Regression: private profile hides username but must still flag own comment.
        private_user = User.objects.create_user(
            email='private_own@example.com', username='privateown', password='Password1',
            is_username_public=False, is_active=True,
        )
        comment = Comment.objects.create(story=story, author=private_user, text='Incognito')
        request = MagicMock()
        request.user = private_user
        data = CommentResponseSerializer(comment, context={'request': request}).data
        assert data['author_username'] is None
        assert data['is_own_comment'] is True


# ── LikeResponseSerializer ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLikeResponseSerializer:
    def _make_like(self):
        user = User.objects.create_user(
            email='likesr@example.com', username='likesr', password='Password1', is_active=True,
        )
        story = Story.objects.create(
            user=user, title='T', narrative='N',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2000,
        )
        return Like.objects.create(user=user, story=story)

    def test_contains_expected_fields(self):
        like = self._make_like()
        data = LikeResponseSerializer(like).data
        for field in ['id', 'story_id', 'created_at']:
            assert field in data

    def test_story_id_matches(self):
        like = self._make_like()
        data = LikeResponseSerializer(like).data
        assert data['story_id'] == like.story_id

    def test_id_matches(self):
        like = self._make_like()
        data = LikeResponseSerializer(like).data
        assert data['id'] == like.pk
