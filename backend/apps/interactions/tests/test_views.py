"""Integration tests for comment endpoints."""
import pytest

from rest_framework.test import APIClient

from apps.interactions.models import Comment
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
