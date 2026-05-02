"""Admin content-removal tests: DELETE /moderation/comments/{id}/"""
import pytest

from rest_framework.test import APIClient

from apps.interactions.models import Comment
from apps.users.models import RoleChoices, User


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email='admin@example.com',
        username='adminuser',
        password='Password1',
        role=RoleChoices.ADMIN,
        is_staff=True,
    )


@pytest.fixture
def admin_client(client, admin_user):
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def auth_client(client, user):
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def comment(user, story):
    return Comment.objects.create(story=story, author=user, text='A comment.')


def _url(comment_id):
    return f'/moderation/comments/{comment_id}/'


# ── DELETE /moderation/comments/{id}/ ────────────────────────────────────────

@pytest.mark.django_db
class TestAdminCommentRemoval:

    def test_admin_delete_comment_returns_204(self, admin_client, comment):
        resp = admin_client.delete(_url(comment.pk))
        assert resp.status_code == 204

    def test_comment_is_hard_deleted(self, admin_client, comment):
        pk = comment.pk
        admin_client.delete(_url(comment.pk))
        assert not Comment.objects.filter(pk=pk).exists()

    def test_non_admin_gets_403(self, auth_client, comment):
        resp = auth_client.delete(_url(comment.pk))
        assert resp.status_code == 403

    def test_unauthenticated_gets_401(self, client, comment):
        resp = client.delete(_url(comment.pk))
        assert resp.status_code == 401

    def test_nonexistent_comment_gets_404(self, admin_client):
        resp = admin_client.delete(_url(999999))
        assert resp.status_code == 404
