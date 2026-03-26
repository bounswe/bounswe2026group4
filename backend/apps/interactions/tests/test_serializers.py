"""Unit tests for comment serializers."""
import pytest

from apps.interactions.models import Comment
from apps.interactions.serializers import CommentCreateSerializer, CommentResponseSerializer


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
        for field in ['id', 'story_id', 'author_username', 'text', 'is_anonymized', 'created_at']:
            assert field in data
