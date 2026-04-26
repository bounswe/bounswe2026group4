from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.notifications.models import Notification, NotificationType
from apps.stories.models import Story
from apps.users.models import User


def _make_user(email, username):
    return User.objects.create_user(email=email, username=username, password='Password1')


def _make_story(user):
    return Story.objects.create(
        user=user, title='My Story', narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='P', time_type=Story.TIME_EXACT, year=2000,
    )


def _make_notification(recipient, actor=None, notification_type=NotificationType.NEW_LIKE):
    return Notification.objects.create(
        recipient=recipient,
        actor=actor,
        notification_type=notification_type,
        message='msg',
    )


LIST_URL = '/notifications/'


def _read_url(pk):
    return f'/notifications/{pk}/read/'


def _detail_url(pk):
    return f'/notifications/{pk}/'


@pytest.mark.django_db
class TestNotificationListView:
    def setup_method(self):
        self.user = _make_user('user@example.com', 'user')
        self.other = _make_user('other@example.com', 'other')
        self.client = APIClient()

    def test_list_requires_authentication(self):
        response = self.client.get(LIST_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_returns_own_notifications(self):
        _make_notification(self.user)
        _make_notification(self.user)
        _make_notification(self.other)  # should not appear
        self.client.force_authenticate(user=self.user)
        response = self.client.get(LIST_URL)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['notifications']) == 2

    def test_list_response_contains_expected_fields(self):
        _make_notification(self.user, actor=self.other)
        self.client.force_authenticate(user=self.user)
        response = self.client.get(LIST_URL)
        notif = response.data['notifications'][0]
        for field in ['id', 'notification_type', 'message', 'actor', 'story_id', 'comment_id', 'is_read', 'created_at']:
            assert field in notif

    def test_list_actor_contains_id_and_username(self):
        _make_notification(self.user, actor=self.other)
        self.client.force_authenticate(user=self.user)
        response = self.client.get(LIST_URL)
        actor = response.data['notifications'][0]['actor']
        assert actor['id'] == self.other.pk
        assert actor['username'] == self.other.username

    def test_list_unread_notifications_appear_before_read(self):
        read_notif = Notification.objects.create(
            recipient=self.user, notification_type=NotificationType.NEW_LIKE,
            message='read', is_read=True,
        )
        unread_notif = Notification.objects.create(
            recipient=self.user, notification_type=NotificationType.NEW_LIKE,
            message='unread', is_read=False,
        )
        self.client.force_authenticate(user=self.user)
        response = self.client.get(LIST_URL)
        ids = [n['id'] for n in response.data['notifications']]
        assert ids[0] == unread_notif.pk
        assert ids[1] == read_notif.pk

    def test_list_empty_inbox_returns_empty_list(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(LIST_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['notifications'] == []


@pytest.mark.django_db
class TestNotificationClearAllView:
    def setup_method(self):
        self.user = _make_user('user@example.com', 'user')
        self.other = _make_user('other@example.com', 'other')
        self.client = APIClient()

    def test_clear_all_requires_authentication(self):
        response = self.client.delete(LIST_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_clear_all_removes_all_user_notifications(self):
        _make_notification(self.user)
        _make_notification(self.user)
        self.client.force_authenticate(user=self.user)
        response = self.client.delete(LIST_URL)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert Notification.objects.filter(recipient=self.user).count() == 0

    def test_clear_all_does_not_affect_other_users_notifications(self):
        _make_notification(self.other)
        self.client.force_authenticate(user=self.user)
        self.client.delete(LIST_URL)
        assert Notification.objects.filter(recipient=self.other).count() == 1


@pytest.mark.django_db
class TestNotificationMarkReadView:
    def setup_method(self):
        self.user = _make_user('user@example.com', 'user')
        self.other = _make_user('other@example.com', 'other')
        self.client = APIClient()
        self.notif = _make_notification(self.user)

    def test_mark_read_requires_authentication(self):
        response = self.client.patch(_read_url(self.notif.pk), {'is_read': True}, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_mark_notification_as_read(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(_read_url(self.notif.pk), {'is_read': True}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_read'] is True
        assert Notification.objects.get(pk=self.notif.pk).is_read is True

    def test_mark_notification_as_unread(self):
        self.notif.is_read = True
        self.notif.save()
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(_read_url(self.notif.pk), {'is_read': False}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_read'] is False

    def test_mark_read_on_other_users_notification_returns_404(self):
        other_notif = _make_notification(self.other)
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(_read_url(other_notif.pk), {'is_read': True}, format='json')
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_mark_read_with_missing_body_returns_400(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(_read_url(self.notif.pk), {}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_mark_read_nonexistent_notification_returns_404(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(_read_url(99999), {'is_read': True}, format='json')
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestNotificationDetailView:
    def setup_method(self):
        self.user = _make_user('user@example.com', 'user')
        self.other = _make_user('other@example.com', 'other')
        self.client = APIClient()
        self.notif = _make_notification(self.user)

    def test_delete_requires_authentication(self):
        response = self.client.delete(_detail_url(self.notif.pk))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_delete_own_notification(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.delete(_detail_url(self.notif.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Notification.objects.filter(pk=self.notif.pk).exists()

    def test_delete_other_users_notification_returns_404(self):
        other_notif = _make_notification(self.other)
        self.client.force_authenticate(user=self.user)
        response = self.client.delete(_detail_url(other_notif.pk))
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert Notification.objects.filter(pk=other_notif.pk).exists()

    def test_delete_nonexistent_notification_returns_404(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.delete(_detail_url(99999))
        assert response.status_code == status.HTTP_404_NOT_FOUND
