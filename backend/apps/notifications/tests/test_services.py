from decimal import Decimal

import pytest

from apps.notifications.models import Notification, NotificationPreference, NotificationType
from apps.notifications.services import (
    create_notification,
    delete_all_notifications,
    delete_notification,
    get_notifications,
    is_notification_enabled,
    mark_notification_read,
)
from apps.stories.models import Story
from apps.users.models import User


def _make_user(email, username):
    return User.objects.create_user(email=email, username=username, password='Password1')


def _make_story(user):
    return Story.objects.create(
        user=user, title='T', narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='P', time_type=Story.TIME_EXACT, year=2000,
    )


@pytest.mark.django_db
class TestIsNotificationEnabled:
    def setup_method(self):
        self.user = _make_user('u@example.com', 'u')

    def test_enabled_by_default_when_no_preference_row(self):
        assert is_notification_enabled(self.user, NotificationType.NEW_LIKE) is True

    def test_returns_false_when_preference_disabled(self):
        NotificationPreference.objects.create(
            user=self.user,
            notification_type=NotificationType.NEW_LIKE,
            is_enabled=False,
        )
        assert is_notification_enabled(self.user, NotificationType.NEW_LIKE) is False

    def test_returns_true_when_preference_enabled(self):
        NotificationPreference.objects.create(
            user=self.user,
            notification_type=NotificationType.NEW_LIKE,
            is_enabled=True,
        )
        assert is_notification_enabled(self.user, NotificationType.NEW_LIKE) is True


@pytest.mark.django_db
class TestCreateNotification:
    def setup_method(self):
        self.recipient = _make_user('r@example.com', 'recipient')
        self.actor = _make_user('a@example.com', 'actor')

    def test_create_notification_returns_notification(self):
        n = create_notification(
            recipient=self.recipient,
            notification_type=NotificationType.NEW_LIKE,
            message='Someone liked your story.',
            actor=self.actor,
        )
        assert n is not None
        assert n.pk is not None
        assert n.recipient == self.recipient
        assert n.actor == self.actor
        assert n.is_read is False

    def test_create_notification_persists_to_db(self):
        create_notification(
            recipient=self.recipient,
            notification_type=NotificationType.NEW_LIKE,
            message='msg',
            actor=self.actor,
        )
        assert Notification.objects.filter(recipient=self.recipient).count() == 1

    def test_create_notification_suppressed_when_actor_is_recipient(self):
        result = create_notification(
            recipient=self.recipient,
            notification_type=NotificationType.NEW_LIKE,
            message='msg',
            actor=self.recipient,  # self-notification
        )
        assert result is None
        assert Notification.objects.filter(recipient=self.recipient).count() == 0

    def test_create_notification_suppressed_when_type_disabled(self):
        NotificationPreference.objects.create(
            user=self.recipient,
            notification_type=NotificationType.NEW_LIKE,
            is_enabled=False,
        )
        result = create_notification(
            recipient=self.recipient,
            notification_type=NotificationType.NEW_LIKE,
            message='msg',
            actor=self.actor,
        )
        assert result is None
        assert Notification.objects.filter(recipient=self.recipient).count() == 0

    def test_create_notification_without_actor_succeeds(self):
        n = create_notification(
            recipient=self.recipient,
            notification_type=NotificationType.BADGE_EARNED,
            message='You earned a badge!',
        )
        assert n is not None
        assert n.actor is None


@pytest.mark.django_db
class TestGetNotifications:
    def setup_method(self):
        self.user = _make_user('user@example.com', 'user')
        self.other = _make_user('other@example.com', 'other')

    def test_returns_only_recipient_notifications(self):
        Notification.objects.create(
            recipient=self.user, notification_type=NotificationType.NEW_LIKE, message='A',
        )
        Notification.objects.create(
            recipient=self.other, notification_type=NotificationType.NEW_LIKE, message='B',
        )
        qs = get_notifications(self.user)
        assert qs.count() == 1
        assert qs.first().message == 'A'

    def test_unread_notifications_come_before_read(self):
        read = Notification.objects.create(
            recipient=self.user, notification_type=NotificationType.NEW_LIKE,
            message='read', is_read=True,
        )
        unread = Notification.objects.create(
            recipient=self.user, notification_type=NotificationType.NEW_LIKE,
            message='unread', is_read=False,
        )
        result = list(get_notifications(self.user))
        assert result[0].pk == unread.pk
        assert result[1].pk == read.pk


@pytest.mark.django_db
class TestMarkNotificationRead:
    def setup_method(self):
        self.user = _make_user('user@example.com', 'user')
        self.notification = Notification.objects.create(
            recipient=self.user, notification_type=NotificationType.NEW_LIKE, message='msg',
        )

    def test_mark_as_read(self):
        n = mark_notification_read(self.notification, is_read=True)
        assert n.is_read is True
        assert Notification.objects.get(pk=n.pk).is_read is True

    def test_mark_as_unread(self):
        self.notification.is_read = True
        self.notification.save()
        n = mark_notification_read(self.notification, is_read=False)
        assert n.is_read is False
        assert Notification.objects.get(pk=n.pk).is_read is False


@pytest.mark.django_db
class TestDeleteNotification:
    def setup_method(self):
        self.user = _make_user('user@example.com', 'user')

    def test_delete_single_notification(self):
        n = Notification.objects.create(
            recipient=self.user, notification_type=NotificationType.NEW_LIKE, message='msg',
        )
        delete_notification(n)
        assert Notification.objects.filter(pk=n.pk).count() == 0

    def test_delete_does_not_affect_other_notifications(self):
        n1 = Notification.objects.create(
            recipient=self.user, notification_type=NotificationType.NEW_LIKE, message='A',
        )
        n2 = Notification.objects.create(
            recipient=self.user, notification_type=NotificationType.NEW_LIKE, message='B',
        )
        delete_notification(n1)
        assert Notification.objects.filter(pk=n2.pk).exists()


@pytest.mark.django_db
class TestDeleteAllNotifications:
    def setup_method(self):
        self.user = _make_user('user@example.com', 'user')
        self.other = _make_user('other@example.com', 'other')

    def test_clears_all_user_notifications(self):
        Notification.objects.create(
            recipient=self.user, notification_type=NotificationType.NEW_LIKE, message='A',
        )
        Notification.objects.create(
            recipient=self.user, notification_type=NotificationType.NEW_LIKE, message='B',
        )
        delete_all_notifications(self.user)
        assert Notification.objects.filter(recipient=self.user).count() == 0

    def test_does_not_delete_other_users_notifications(self):
        Notification.objects.create(
            recipient=self.other, notification_type=NotificationType.NEW_LIKE, message='keep',
        )
        delete_all_notifications(self.user)
        assert Notification.objects.filter(recipient=self.other).count() == 1
