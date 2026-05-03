from decimal import Decimal

import pytest

from django.db import IntegrityError, transaction

from apps.gamification.constants import (
    BADGE_CRITERIA_REGISTRATION,
    BADGE_CRITERIA_STORIES_PUBLISHED,
    BADGE_CRITERIA_POINTS_TOTAL,
    POINT_VALUES,
    STORY_LIKED,
    STORY_LIKE_REMOVED,
    STORY_PUBLISHED,
)
from apps.gamification.models import Badge, PointTransaction, UserBadge
from apps.stories.models import Story
from apps.users.models import User


def _make_story(user):
    return Story.objects.create(
        user=user, title='T', narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='P', time_type=Story.TIME_EXACT, year=2000,
    )


def _make_badge(name='Pioneer', criteria_type=BADGE_CRITERIA_REGISTRATION, threshold=0):
    return Badge.objects.create(
        name=name,
        description='A test badge.',
        criteria_type=criteria_type,
        criteria_threshold=threshold,
    )


@pytest.mark.django_db
class TestBadge:
    def test_badge_can_be_created(self):
        badge = _make_badge()
        assert badge.pk is not None

    def test_criteria_threshold_defaults_to_zero(self):
        badge = _make_badge()
        assert badge.criteria_threshold == 0

    def test_badge_name_must_be_unique(self):
        _make_badge(name='Pioneer')
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                _make_badge(name='Pioneer')

    def test_all_criteria_types_are_accepted(self):
        for i, criteria in enumerate([
            BADGE_CRITERIA_REGISTRATION,
            BADGE_CRITERIA_STORIES_PUBLISHED,
            BADGE_CRITERIA_POINTS_TOTAL,
        ]):
            badge = Badge.objects.create(
                name=f'Badge-{i}', description='desc',
                criteria_type=criteria, criteria_threshold=0,
            )
            assert badge.criteria_type == criteria

    def test_str_returns_name(self):
        badge = _make_badge(name='Pioneer')
        assert str(badge) == 'Pioneer'


@pytest.mark.django_db
class TestUserBadge:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='earner@example.com', username='earner', password='Password1',
        )
        self.badge = _make_badge()

    def test_user_badge_can_be_created(self):
        ub = UserBadge.objects.create(user=self.user, badge=self.badge)
        assert ub.pk is not None

    def test_awarded_at_is_set_automatically(self):
        ub = UserBadge.objects.create(user=self.user, badge=self.badge)
        assert ub.awarded_at is not None

    def test_same_badge_cannot_be_awarded_twice(self):
        UserBadge.objects.create(user=self.user, badge=self.badge)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                UserBadge.objects.create(user=self.user, badge=self.badge)

    def test_different_users_can_earn_same_badge(self):
        other = User.objects.create_user(
            email='other@example.com', username='other', password='Password1',
        )
        UserBadge.objects.create(user=self.user, badge=self.badge)
        UserBadge.objects.create(user=other, badge=self.badge)
        assert UserBadge.objects.filter(badge=self.badge).count() == 2

    def test_user_can_earn_multiple_different_badges(self):
        badge2 = _make_badge(name='Contributor',
                              criteria_type=BADGE_CRITERIA_STORIES_PUBLISHED, threshold=1)
        UserBadge.objects.create(user=self.user, badge=self.badge)
        UserBadge.objects.create(user=self.user, badge=badge2)
        assert UserBadge.objects.filter(user=self.user).count() == 2

    def test_user_badge_deleted_when_user_is_deleted(self):
        ub = UserBadge.objects.create(user=self.user, badge=self.badge)
        ub_pk = ub.pk
        self.user.delete()
        assert not UserBadge.objects.filter(pk=ub_pk).exists()

    def test_user_badge_deleted_when_badge_is_deleted(self):
        ub = UserBadge.objects.create(user=self.user, badge=self.badge)
        ub_pk = ub.pk
        self.badge.delete()
        assert not UserBadge.objects.filter(pk=ub_pk).exists()

    def test_str_contains_badge_name(self):
        ub = UserBadge.objects.create(user=self.user, badge=self.badge)
        assert 'Pioneer' in str(ub)


@pytest.mark.django_db
class TestPointTransaction:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='pointer@example.com', username='pointer', password='Password1',
        )
        self.story = _make_story(self.user)

    def test_transaction_can_be_created(self):
        tx = PointTransaction.objects.create(
            user=self.user,
            amount=POINT_VALUES[STORY_PUBLISHED],
            event_type=STORY_PUBLISHED,
            story=self.story,
        )
        assert tx.pk is not None

    def test_created_at_is_set_automatically(self):
        tx = PointTransaction.objects.create(
            user=self.user, amount=50, event_type=STORY_PUBLISHED,
        )
        assert tx.created_at is not None

    def test_positive_amount_stored_correctly(self):
        tx = PointTransaction.objects.create(
            user=self.user, amount=POINT_VALUES[STORY_LIKED], event_type=STORY_LIKED,
        )
        tx.refresh_from_db()
        assert tx.amount == 2

    def test_negative_amount_stored_correctly(self):
        tx = PointTransaction.objects.create(
            user=self.user, amount=POINT_VALUES[STORY_LIKE_REMOVED],
            event_type=STORY_LIKE_REMOVED,
        )
        tx.refresh_from_db()
        assert tx.amount == -2

    def test_story_set_null_when_story_is_deleted(self):
        tx = PointTransaction.objects.create(
            user=self.user, amount=50,
            event_type=STORY_PUBLISHED, story=self.story,
        )
        tx_pk = tx.pk
        self.story.delete()
        assert PointTransaction.objects.get(pk=tx_pk).story is None

    def test_transaction_deleted_when_user_is_deleted(self):
        tx = PointTransaction.objects.create(
            user=self.user, amount=50, event_type=STORY_PUBLISHED,
        )
        tx_pk = tx.pk
        self.user.delete()
        assert not PointTransaction.objects.filter(pk=tx_pk).exists()

    def test_user_can_have_multiple_transactions(self):
        PointTransaction.objects.create(user=self.user, amount=50,
                                        event_type=STORY_PUBLISHED)
        PointTransaction.objects.create(user=self.user, amount=2,
                                        event_type=STORY_LIKED)
        assert PointTransaction.objects.filter(user=self.user).count() == 2

    def test_point_values_match_requirements(self):
        # Verify constants exactly match req. 1.7.1
        assert POINT_VALUES['story_published'] == 50
        assert POINT_VALUES['story_liked'] == 2
        assert POINT_VALUES['story_commented'] == 4
        assert POINT_VALUES['story_saved'] == 3
        assert POINT_VALUES['story_like_removed'] == -2
        assert POINT_VALUES['story_comment_removed'] == -4
        assert POINT_VALUES['story_save_removed'] == -3
        assert POINT_VALUES['user_liked'] == 1
        assert POINT_VALUES['user_like_removed'] == -1
        assert POINT_VALUES['user_commented'] == 2
        assert POINT_VALUES['user_comment_removed'] == -2

    def test_str_contains_sign_amount_and_event_type(self):
        tx = PointTransaction.objects.create(
            user=self.user, amount=50, event_type=STORY_PUBLISHED,
        )
        assert '+50' in str(tx)
        assert STORY_PUBLISHED in str(tx)
