"""Integration tests for comment and like endpoints."""
import pytest

from rest_framework.test import APIClient

from apps.interactions.models import Comment, Like
from apps.stories.models import Story
from apps.users.models import RoleChoices, User


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def auth_client(client, user):
    """APIClient authenticated as the default registered user."""
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email='admin@example.com',
        username='adminuser',
        password='Password1',
        role=RoleChoices.ADMIN,
    )


@pytest.fixture
def admin_client(client, admin_user):
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def comment(user, story):
    return Comment.objects.create(story=story, author=user, text='Initial comment')


# ── POST /stories/<story_id>/comments/ ───────────────────────────────────────

@pytest.mark.django_db
class TestStoryCommentCreate:
    url = '/stories/{story_id}/comments/'

    def test_create_comment_success(self, auth_client, story):
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'text': 'Great story!'},
            format='json',
        )
        assert response.status_code == 201
        assert response.data['comment']['text'] == 'Great story!'
        assert Comment.objects.filter(story=story).exists()

    def test_create_comment_unauthenticated(self, client, story):
        response = client.post(
            self.url.format(story_id=story.pk),
            {'text': 'Hello'},
            format='json',
        )
        assert response.status_code == 401

    def test_create_comment_blank_text(self, auth_client, story):
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'text': ''},
            format='json',
        )
        assert response.status_code == 400

    def test_create_comment_story_not_found(self, auth_client):
        response = auth_client.post(
            self.url.format(story_id=99999),
            {'text': 'Hello'},
            format='json',
        )
        assert response.status_code == 404

    def test_create_comment_removed_story(self, auth_client, story):
        story.status = Story.STATUS_REMOVED
        story.save()
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'text': 'Hello'},
            format='json',
        )
        assert response.status_code == 404

    def test_create_comment_response_contains_expected_fields(self, auth_client, story):
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'text': 'Nice!'},
            format='json',
        )
        assert response.status_code == 201
        comment_data = response.data['comment']
        for field in ['id', 'story_id', 'author_username', 'text', 'is_anonymized', 'created_at']:
            assert field in comment_data


# ── DELETE /comments/<comment_id>/ ───────────────────────────────────────────

@pytest.mark.django_db
class TestCommentDelete:
    url = '/comments/{comment_id}/'

    def test_delete_comment_by_author(self, auth_client, comment):
        pk = comment.pk
        response = auth_client.delete(self.url.format(comment_id=pk))
        assert response.status_code == 204
        assert not Comment.objects.filter(pk=pk).exists()

    def test_delete_comment_by_admin(self, admin_client, comment):
        # Admins can remove any comment regardless of authorship (req. 1.1.3.3)
        pk = comment.pk
        response = admin_client.delete(self.url.format(comment_id=pk))
        assert response.status_code == 204
        assert not Comment.objects.filter(pk=pk).exists()

    def test_delete_comment_by_other_user(self, client, second_user, comment):
        client.force_authenticate(user=second_user)
        response = client.delete(self.url.format(comment_id=comment.pk))
        assert response.status_code == 403
        assert Comment.objects.filter(pk=comment.pk).exists()

    def test_delete_comment_unauthenticated(self, client, comment):
        response = client.delete(self.url.format(comment_id=comment.pk))
        assert response.status_code == 401
        assert Comment.objects.filter(pk=comment.pk).exists()

    def test_delete_comment_not_found(self, auth_client):
        response = auth_client.delete(self.url.format(comment_id=99999))
        assert response.status_code == 404


# ── POST /stories/<story_id>/like/ ───────────────────────────────────────────

@pytest.mark.django_db
class TestStoryLike:
    url = '/stories/{story_id}/like/'

    def test_like_story_success(self, auth_client, story):
        response = auth_client.post(self.url.format(story_id=story.pk))
        assert response.status_code == 201
        assert response.data['like']['story_id'] == story.pk
        assert Like.objects.filter(story=story).count() == 1

    def test_like_updates_story_like_count(self, auth_client, story):
        auth_client.post(self.url.format(story_id=story.pk))
        story.refresh_from_db()
        assert story.like_count == 1

    def test_like_response_contains_expected_fields(self, auth_client, story):
        response = auth_client.post(self.url.format(story_id=story.pk))
        assert response.status_code == 201
        for field in ['id', 'story_id', 'created_at']:
            assert field in response.data['like']

    def test_like_story_unauthenticated(self, client, story):
        response = client.post(self.url.format(story_id=story.pk))
        assert response.status_code == 401

    def test_like_story_not_found(self, auth_client):
        response = auth_client.post(self.url.format(story_id=99999))
        assert response.status_code == 404

    def test_like_removed_story_returns_404(self, auth_client, story):
        story.status = Story.STATUS_REMOVED
        story.save()
        response = auth_client.post(self.url.format(story_id=story.pk))
        assert response.status_code == 404

    def test_duplicate_like_returns_400(self, auth_client, story):
        auth_client.post(self.url.format(story_id=story.pk))
        response = auth_client.post(self.url.format(story_id=story.pk))
        assert response.status_code == 400
        # like_count must not double-count the rejected duplicate
        story.refresh_from_db()
        assert story.like_count == 1


# ── DELETE /stories/<story_id>/like/ ─────────────────────────────────────────

@pytest.mark.django_db
class TestStoryUnlike:
    url = '/stories/{story_id}/like/'

    def test_unlike_story_success(self, auth_client, user, story):
        Like.objects.create(user=user, story=story)
        story.like_count = 1
        story.save()

        response = auth_client.delete(self.url.format(story_id=story.pk))
        assert response.status_code == 204
        assert not Like.objects.filter(user=user, story=story).exists()

    def test_unlike_decrements_like_count(self, auth_client, user, story):
        Like.objects.create(user=user, story=story)
        story.like_count = 1
        story.save()

        auth_client.delete(self.url.format(story_id=story.pk))
        story.refresh_from_db()
        assert story.like_count == 0

    def test_unlike_story_unauthenticated(self, client, user, story):
        Like.objects.create(user=user, story=story)
        response = client.delete(self.url.format(story_id=story.pk))
        assert response.status_code == 401

    def test_unlike_story_not_liked_returns_404(self, auth_client, story):
        response = auth_client.delete(self.url.format(story_id=story.pk))
        assert response.status_code == 404

    def test_unlike_story_not_found(self, auth_client):
        response = auth_client.delete(self.url.format(story_id=99999))
        assert response.status_code == 404


# ── GET /stories/<story_id>/comments/ ────────────────────────────────────────

@pytest.mark.django_db
class TestStoryCommentList:
    url = '/stories/{story_id}/comments/'

    def test_returns_200_for_unauthenticated(self, client, story):
        response = client.get(self.url.format(story_id=story.pk))
        assert response.status_code == 200

    def test_returns_200_for_authenticated(self, auth_client, story):
        response = auth_client.get(self.url.format(story_id=story.pk))
        assert response.status_code == 200

    def test_response_is_paginated(self, client, story):
        response = client.get(self.url.format(story_id=story.pk))
        for key in ['count', 'next', 'previous', 'results']:
            assert key in response.data

    def test_returns_empty_list_when_no_comments(self, client, story):
        response = client.get(self.url.format(story_id=story.pk))
        assert response.data['count'] == 0
        assert response.data['results'] == []

    def test_returns_comments_for_story(self, client, story, user):
        Comment.objects.create(story=story, author=user, text='First comment')
        Comment.objects.create(story=story, author=user, text='Second comment')
        response = client.get(self.url.format(story_id=story.pk))
        assert response.data['count'] == 2

    def test_result_contains_expected_fields(self, client, story, user):
        Comment.objects.create(story=story, author=user, text='Hello')
        response = client.get(self.url.format(story_id=story.pk))
        result = response.data['results'][0]
        assert set(result.keys()) == {'id', 'story_id', 'author_username', 'text', 'is_anonymized', 'created_at'}

    def test_comments_ordered_oldest_first(self, client, story, user):
        c1 = Comment.objects.create(story=story, author=user, text='Older')
        c2 = Comment.objects.create(story=story, author=user, text='Newer')
        response = client.get(self.url.format(story_id=story.pk))
        ids = [r['id'] for r in response.data['results']]
        assert ids == [c1.pk, c2.pk]

    def test_story_not_found_returns_404(self, client):
        response = client.get(self.url.format(story_id=99999))
        assert response.status_code == 404

    def test_removed_story_returns_404(self, client, story):
        story.status = Story.STATUS_REMOVED
        story.save()
        response = client.get(self.url.format(story_id=story.pk))
        assert response.status_code == 404

    def test_anonymized_comment_shows_null_author(self, client, story, user):
        Comment.objects.create(story=story, author=None, text='Anonymous', is_anonymized=True)
        response = client.get(self.url.format(story_id=story.pk))
        assert response.data['results'][0]['author_username'] is None

    def test_private_username_author_shows_null_in_list(self, client, story):
        private_user = User.objects.create_user(
            email='private_view@example.com', username='privateview', password='Password1',
            is_username_public=False,
        )
        Comment.objects.create(story=story, author=private_user, text='Hidden identity')
        response = client.get(self.url.format(story_id=story.pk))
        assert response.status_code == 200
        assert response.data['results'][0]['author_username'] is None
        assert response.data['results'][0]['is_anonymized'] is False

    def test_public_username_author_shows_username_in_list(self, client, story):
        public_user = User.objects.create_user(
            email='public_view@example.com', username='publicview', password='Password1',
            is_username_public=True,
        )
        Comment.objects.create(story=story, author=public_user, text='Visible identity')
        response = client.get(self.url.format(story_id=story.pk))
        assert response.status_code == 200
        assert response.data['results'][0]['author_username'] == 'publicview'

    def test_only_returns_comments_for_requested_story(self, client, story, second_user):
        from decimal import Decimal
        other_story = Story.objects.create(
            user=second_user,
            title='Other Story',
            narrative='Other narrative.',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('41.0'),
            location_lng=Decimal('29.0'),
            location_name='Ankara',
            time_type=Story.TIME_EXACT,
            year=2000,
        )
        Comment.objects.create(story=story, author=second_user, text='For first story')
        Comment.objects.create(story=other_story, author=second_user, text='For other story')
        response = client.get(self.url.format(story_id=story.pk))
        assert response.data['count'] == 1
        assert response.data['results'][0]['text'] == 'For first story'
