from decimal import Decimal

import pytest

from django.db import IntegrityError, transaction

from apps.notifications.models import Notification, NotificationPreference, NotificationType
from apps.stories.models import Story
from apps.users.models import User


def _make_story(user):
    return Story.objects.create(
        user=user, title='T', narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='P', time_type=Story.TIME_EXACT, year=2000,
    )


@pytest.mark.django_db
class TestNotification:
    def setup_method(self):
        self.recipient = User.objects.create_user(
            email='recipient@example.com', username='recipient', password='Password1',
        )
        self.actor = User.objects.create_user(
            email='actor@example.com', username='actor', password='Password1',
        )
        self.story = _make_story(self.recipient)

    def test_notification_can_be_created(self):
        n = Notification.objects.create(
            recipient=self.recipient,
            notification_type=NotificationType.NEW_LIKE,
            message='Someone liked your story.',
        )
        assert n.pk is not None

    def test_is_read_defaults_to_false(self):
        n = Notification.objects.create(
            recipient=self.recipient,
            notification_type=NotificationType.NEW_LIKE,
            message='msg',
        )
        assert n.is_read is False

    def test_created_at_is_set_automatically(self):
        n = Notification.objects.create(
            recipient=self.recipient,
            notification_type=NotificationType.NEW_COMMENT,
            message='msg',
        )
        assert n.created_at is not None

    def test_all_notification_types_are_accepted(self):
        for ntype in NotificationType.values:
            n = Notification.objects.create(
                recipient=self.recipient,
                notification_type=ntype,
                message='msg',
            )
            assert n.notification_type == ntype

    def test_notification_deleted_when_recipient_is_deleted(self):
        n = Notification.objects.create(
            recipient=self.recipient,
            notification_type=NotificationType.NEW_LIKE,
            message='msg',
        )
        n_pk = n.pk
        self.recipient.delete()
        assert not Notification.objects.filter(pk=n_pk).exists()

    def test_actor_set_null_when_actor_user_is_deleted(self):
        n = Notification.objects.create(
            recipient=self.recipient, actor=self.actor,
            notification_type=NotificationType.NEW_LIKE, message='msg',
        )
        n_pk = n.pk
        self.actor.delete()
        assert Notification.objects.get(pk=n_pk).actor is None

    def test_story_set_null_when_story_is_deleted(self):
        n = Notification.objects.create(
            recipient=self.recipient,
            notification_type=NotificationType.STORY_REMOVED,
            message='msg', story=self.story,
        )
        n_pk = n.pk
        self.story.delete()
        assert Notification.objects.get(pk=n_pk).story is None

    def test_unread_notifications_ordered_before_read(self):
        # Default ordering: ['is_read', '-created_at']
        # is_read=False (0) sorts before is_read=True (1)
        read_n = Notification.objects.create(
            recipient=self.recipient,
            notification_type=NotificationType.NEW_LIKE,
            message='read', is_read=True,
        )
        unread_n = Notification.objects.create(
            recipient=self.recipient,
            notification_type=NotificationType.NEW_COMMENT,
            message='unread', is_read=False,
        )
        notifications = list(Notification.objects.filter(recipient=self.recipient))
        assert notifications[0].pk == unread_n.pk
        assert notifications[1].pk == read_n.pk

    def test_str_contains_type_and_recipient_pk(self):
        n = Notification.objects.create(
            recipient=self.recipient,
            notification_type=NotificationType.NEW_LIKE,
            message='msg',
        )
        assert 'new_like' in str(n)
        assert str(self.recipient.pk) in str(n)


@pytest.mark.django_db
class TestNotificationPreference:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='pref@example.com', username='prefuser', password='Password1',
        )

    def test_preference_can_be_created(self):
        pref = NotificationPreference.objects.create(
            user=self.user, notification_type=NotificationType.NEW_LIKE,
        )
        assert pref.pk is not None

    def test_is_enabled_defaults_to_true(self):
        pref = NotificationPreference.objects.create(
            user=self.user, notification_type=NotificationType.NEW_LIKE,
        )
        assert pref.is_enabled is True

    def test_preference_can_be_disabled(self):
        pref = NotificationPreference.objects.create(
            user=self.user, notification_type=NotificationType.NEW_LIKE,
            is_enabled=False,
        )
        pref.refresh_from_db()
        assert pref.is_enabled is False

    def test_duplicate_type_per_user_raises_integrity_error(self):
        NotificationPreference.objects.create(
            user=self.user, notification_type=NotificationType.NEW_LIKE,
        )
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                NotificationPreference.objects.create(
                    user=self.user, notification_type=NotificationType.NEW_LIKE,
                )

    def test_different_types_for_same_user_are_allowed(self):
        NotificationPreference.objects.create(
            user=self.user, notification_type=NotificationType.NEW_LIKE,
        )
        NotificationPreference.objects.create(
            user=self.user, notification_type=NotificationType.NEW_COMMENT,
        )
        assert NotificationPreference.objects.filter(user=self.user).count() == 2

    def test_preferences_deleted_when_user_is_deleted(self):
        pref = NotificationPreference.objects.create(
            user=self.user, notification_type=NotificationType.NEW_LIKE,
        )
        pref_pk = pref.pk
        self.user.delete()
        assert not NotificationPreference.objects.filter(pk=pref_pk).exists()
