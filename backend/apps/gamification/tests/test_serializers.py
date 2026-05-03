from decimal import Decimal

import pytest

from apps.gamification.models import Badge, PointTransaction, UserBadge
from apps.gamification.serializers import (
    BadgeCatalogSerializer,
    PointSummarySerializer,
    PointTransactionSerializer,
    UserBadgeSerializer,
)
from apps.gamification.constants import BADGE_CRITERIA_STORIES_PUBLISHED, STORY_PUBLISHED
from apps.stories.models import Story
from apps.users.models import User


def _make_user(email='u@example.com', username='u'):
    return User.objects.create_user(email=email, username=username, password='Password1', is_active=True)


def _make_badge(name='Pioneer'):
    return Badge.objects.create(
        name=name, description='First badge.',
        criteria_type=BADGE_CRITERIA_STORIES_PUBLISHED, criteria_threshold=1,
    )


def _make_story(user):
    return Story.objects.create(
        user=user, title='T', narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='P', time_type=Story.TIME_EXACT, year=2000,
    )


@pytest.mark.django_db
class TestBadgeCatalogSerializer:
    def test_badge_catalog_serializer_contains_expected_fields(self):
        badge = _make_badge()
        data = BadgeCatalogSerializer(badge).data
        assert set(data.keys()) == {'id', 'name', 'description', 'criteria_type', 'criteria_threshold'}

    def test_badge_catalog_serializer_field_values_match_model(self):
        badge = _make_badge(name='Historian')
        data = BadgeCatalogSerializer(badge).data
        assert data['id'] == badge.pk
        assert data['name'] == 'Historian'
        assert data['description'] == badge.description
        assert data['criteria_type'] == badge.criteria_type
        assert data['criteria_threshold'] == badge.criteria_threshold


@pytest.mark.django_db
class TestUserBadgeSerializer:
    def setup_method(self):
        self.user = _make_user()
        self.badge = _make_badge()
        self.user_badge = UserBadge.objects.create(user=self.user, badge=self.badge)

    def test_user_badge_serializer_contains_expected_fields(self):
        data = UserBadgeSerializer(self.user_badge).data
        assert set(data.keys()) == {'id', 'badge', 'awarded_at'}

    def test_user_badge_serializer_badge_is_nested_dict(self):
        data = UserBadgeSerializer(self.user_badge).data
        assert isinstance(data['badge'], dict)
        assert set(data['badge'].keys()) == {'id', 'name', 'description', 'criteria_type', 'criteria_threshold'}

    def test_user_badge_serializer_badge_values_match(self):
        data = UserBadgeSerializer(self.user_badge).data
        assert data['badge']['name'] == self.badge.name

    def test_user_badge_serializer_awarded_at_is_not_null(self):
        data = UserBadgeSerializer(self.user_badge).data
        assert data['awarded_at'] is not None


class TestPointSummarySerializer:
    def test_point_summary_serializer_contains_expected_fields(self):
        data = PointSummarySerializer({'user_id': 1, 'total_points': 50}).data
        assert set(data.keys()) == {'user_id', 'total_points'}

    def test_point_summary_serializer_values_match_input(self):
        data = PointSummarySerializer({'user_id': 42, 'total_points': 200}).data
        assert data['user_id'] == 42
        assert data['total_points'] == 200

    def test_point_summary_serializer_zero_points(self):
        data = PointSummarySerializer({'user_id': 1, 'total_points': 0}).data
        assert data['total_points'] == 0


@pytest.mark.django_db
class TestPointTransactionSerializer:
    def setup_method(self):
        self.user = _make_user()

    def test_point_transaction_serializer_contains_expected_fields(self):
        tx = PointTransaction.objects.create(user=self.user, amount=50, event_type=STORY_PUBLISHED)
        data = PointTransactionSerializer(tx).data
        assert set(data.keys()) == {'id', 'amount', 'event_type', 'story_id', 'created_at'}

    def test_point_transaction_serializer_story_id_is_null_when_no_story(self):
        tx = PointTransaction.objects.create(user=self.user, amount=50, event_type=STORY_PUBLISHED)
        data = PointTransactionSerializer(tx).data
        assert data['story_id'] is None

    def test_point_transaction_serializer_story_id_matches_when_story_set(self):
        story = _make_story(self.user)
        tx = PointTransaction.objects.create(
            user=self.user, amount=50, event_type=STORY_PUBLISHED, story=story,
        )
        data = PointTransactionSerializer(tx).data
        assert data['story_id'] == story.pk

    def test_point_transaction_serializer_negative_amount(self):
        tx = PointTransaction.objects.create(user=self.user, amount=-50, event_type='story_removed')
        data = PointTransactionSerializer(tx).data
        assert data['amount'] == -50
