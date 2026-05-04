"""Admin content-removal tests: DELETE /moderation/stories/{id}/"""
import pytest

from rest_framework.test import APIClient

from apps.stories.models import Story
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


def _url(story_id):
    return f'/moderation/stories/{story_id}/'


# ── DELETE /moderation/stories/{id}/ ─────────────────────────────────────────

@pytest.mark.django_db
class TestAdminStoryRemoval:

    def test_admin_remove_story_returns_204(self, admin_client, story):
        resp = admin_client.delete(_url(story.pk), {'moderation_reason': 'Violates policy.'}, format='json')
        assert resp.status_code == 204

    def test_remove_sets_status_to_removed(self, admin_client, story):
        admin_client.delete(_url(story.pk), {'moderation_reason': 'Spam content.'}, format='json')
        story.refresh_from_db()
        assert story.status == Story.STATUS_REMOVED

    def test_remove_stores_moderation_reason(self, admin_client, story):
        admin_client.delete(_url(story.pk), {'moderation_reason': 'Explicit content.'}, format='json')
        story.refresh_from_db()
        assert story.moderation_reason == 'Explicit content.'

    def test_moderation_reason_is_required(self, admin_client, story):
        resp = admin_client.delete(_url(story.pk), {}, format='json')
        assert resp.status_code == 400

    def test_blank_moderation_reason_is_rejected(self, admin_client, story):
        resp = admin_client.delete(_url(story.pk), {'moderation_reason': ''}, format='json')
        assert resp.status_code == 400

    def test_non_admin_gets_403(self, auth_client, story):
        resp = auth_client.delete(_url(story.pk), {'moderation_reason': 'X'}, format='json')
        assert resp.status_code == 403

    def test_unauthenticated_gets_401(self, client, story):
        resp = client.delete(_url(story.pk), {'moderation_reason': 'X'}, format='json')
        assert resp.status_code == 401

    def test_nonexistent_story_gets_404(self, admin_client):
        resp = admin_client.delete(_url(999999), {'moderation_reason': 'X'}, format='json')
        assert resp.status_code == 404

    def test_already_removed_story_is_idempotent(self, admin_client, story):
        admin_client.delete(_url(story.pk), {'moderation_reason': 'First removal.'}, format='json')
        resp = admin_client.delete(_url(story.pk), {'moderation_reason': 'Second removal.'}, format='json')
        assert resp.status_code == 204
        story.refresh_from_db()
        assert story.moderation_reason == 'Second removal.'
