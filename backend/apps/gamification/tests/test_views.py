from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.gamification.constants import BADGE_CRITERIA_STORIES_PUBLISHED, STORY_PUBLISHED
from apps.gamification.models import Badge, PointTransaction, UserBadge
from apps.stories.models import Story
from apps.users.models import User


BADGE_CATALOG_URL = '/gamification/badges/'


def _points_url(user_id):
    return f'/users/{user_id}/points/'


def _badges_url(user_id):
    return f'/users/{user_id}/badges/'


def _history_url(user_id):
    return f'/users/{user_id}/point-history/'


def _make_user(email='u@example.com', username='u', active=True, role='registered_user'):
    return User.objects.create_user(
        email=email, username=username, password='Password1',
        is_active=active, role=role,
    )


def _make_admin(email='admin@example.com', username='admin'):
    return User.objects.create_user(
        email=email, username=username, password='Password1',
        is_active=True, role='admin',
    )


def _make_badge(name='Pioneer'):
    badge, _ = Badge.objects.get_or_create(
        name=name,
        defaults={'description': 'desc', 'criteria_type': BADGE_CRITERIA_STORIES_PUBLISHED, 'criteria_threshold': 1},
    )
    return badge


def _make_story(user):
    return Story.objects.create(
        user=user, title='T', narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='P', time_type=Story.TIME_EXACT, year=2000,
    )


@pytest.mark.django_db
class TestUserPointsView:
    def setup_method(self):
        self.client = APIClient()
        self.user = _make_user()
        User.objects.filter(pk=self.user.pk).update(total_points=42)

    def test_get_user_points_returns_200_and_correct_shape(self):
        response = self.client.get(_points_url(self.user.pk))
        assert response.status_code == 200
        assert response.data['user_id'] == self.user.pk
        assert response.data['total_points'] == 42

    def test_get_user_points_is_public_no_auth_required(self):
        # Unauthenticated request should still succeed
        response = self.client.get(_points_url(self.user.pk))
        assert response.status_code == 200

    def test_get_user_points_nonexistent_user_returns_404(self):
        response = self.client.get(_points_url(99999))
        assert response.status_code == 404

    def test_get_user_points_inactive_user_returns_404(self):
        inactive = _make_user('i@example.com', 'inactive', active=False)
        response = self.client.get(_points_url(inactive.pk))
        assert response.status_code == 404


@pytest.mark.django_db
class TestUserBadgesView:
    def setup_method(self):
        self.client = APIClient()
        self.user = _make_user()

    def test_get_user_badges_returns_200_and_paginated_response(self):
        badge1 = _make_badge('First')
        badge2 = _make_badge('Second')
        UserBadge.objects.create(user=self.user, badge=badge1)
        UserBadge.objects.create(user=self.user, badge=badge2)
        response = self.client.get(_badges_url(self.user.pk))
        assert response.status_code == 200
        assert response.data['count'] == 2
        assert isinstance(response.data['results'], list)

    def test_get_user_badges_response_item_shape(self):
        badge = _make_badge()
        UserBadge.objects.create(user=self.user, badge=badge)
        response = self.client.get(_badges_url(self.user.pk))
        item = response.data['results'][0]
        assert set(item.keys()) == {'id', 'badge', 'awarded_at'}
        assert set(item['badge'].keys()) == {'id', 'name', 'description', 'criteria_type', 'criteria_threshold'}

    def test_get_user_badges_is_public_no_auth_required(self):
        response = self.client.get(_badges_url(self.user.pk))
        assert response.status_code == 200

    def test_get_user_badges_empty_list_when_no_badges_earned(self):
        response = self.client.get(_badges_url(self.user.pk))
        assert response.status_code == 200
        assert response.data['count'] == 0
        assert response.data['results'] == []

    def test_get_user_badges_nonexistent_user_returns_404(self):
        response = self.client.get(_badges_url(99999))
        assert response.status_code == 404

    def test_get_user_badges_inactive_user_returns_404(self):
        inactive = _make_user('i@example.com', 'inactive', active=False)
        response = self.client.get(_badges_url(inactive.pk))
        assert response.status_code == 404

    def test_get_user_badges_does_not_include_other_users_badges(self):
        other = _make_user('other@example.com', 'other')
        badge = _make_badge()
        UserBadge.objects.create(user=other, badge=badge)
        response = self.client.get(_badges_url(self.user.pk))
        assert response.data['count'] == 0


@pytest.mark.django_db
class TestUserPointHistoryView:
    def setup_method(self):
        self.client = APIClient()
        self.user = _make_user()

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_get_point_history_owner_can_access(self):
        self._auth(self.user)
        response = self.client.get(_history_url(self.user.pk))
        assert response.status_code == 200

    def test_get_point_history_admin_can_access(self):
        admin = _make_admin()
        self._auth(admin)
        response = self.client.get(_history_url(self.user.pk))
        assert response.status_code == 200

    def test_get_point_history_unauthenticated_returns_401(self):
        response = self.client.get(_history_url(self.user.pk))
        assert response.status_code == 401

    def test_get_point_history_other_user_returns_403(self):
        other = _make_user('other@example.com', 'other')
        self._auth(other)
        response = self.client.get(_history_url(self.user.pk))
        assert response.status_code == 403

    def test_get_point_history_returns_paginated_transactions(self):
        PointTransaction.objects.create(user=self.user, amount=50, event_type=STORY_PUBLISHED)
        PointTransaction.objects.create(user=self.user, amount=2, event_type='story_liked')
        self._auth(self.user)
        response = self.client.get(_history_url(self.user.pk))
        assert response.status_code == 200
        assert response.data['count'] == 2

    def test_get_point_history_response_item_shape(self):
        PointTransaction.objects.create(user=self.user, amount=50, event_type=STORY_PUBLISHED)
        self._auth(self.user)
        response = self.client.get(_history_url(self.user.pk))
        item = response.data['results'][0]
        assert set(item.keys()) == {'id', 'amount', 'event_type', 'story_id', 'created_at'}

    def test_get_point_history_ordered_newest_first(self):
        tx1 = PointTransaction.objects.create(user=self.user, amount=50, event_type=STORY_PUBLISHED)
        tx2 = PointTransaction.objects.create(user=self.user, amount=2, event_type='story_liked')
        self._auth(self.user)
        response = self.client.get(_history_url(self.user.pk))
        results = response.data['results']
        assert results[0]['id'] == tx2.pk
        assert results[1]['id'] == tx1.pk

    def test_get_point_history_nonexistent_user_returns_404(self):
        admin = _make_admin()
        self._auth(admin)
        response = self.client.get(_history_url(99999))
        assert response.status_code == 404

    def test_get_point_history_inactive_user_returns_404(self):
        inactive = _make_user('i@example.com', 'inactive', active=False)
        admin = _make_admin()
        self._auth(admin)
        response = self.client.get(_history_url(inactive.pk))
        assert response.status_code == 404


@pytest.mark.django_db
class TestBadgeCatalogView:
    def setup_method(self):
        self.client = APIClient()

    def test_get_badge_catalog_returns_200_and_paginated_response(self):
        # Seed migration may pre-populate badges; verify HTTP 200 and paginated shape.
        response = self.client.get(BADGE_CATALOG_URL)
        assert response.status_code == 200
        assert 'count' in response.data
        assert 'results' in response.data

    def test_get_badge_catalog_is_public_no_auth_required(self):
        response = self.client.get(BADGE_CATALOG_URL)
        assert response.status_code == 200

    def test_get_badge_catalog_adding_badge_increments_count(self):
        baseline = self.client.get(BADGE_CATALOG_URL).data['count']
        _make_badge('__test_unique_badge__')
        response = self.client.get(BADGE_CATALOG_URL)
        assert response.data['count'] == baseline + 1

    def test_get_badge_catalog_response_item_shape(self):
        # At least one badge must exist (either seeded or created here).
        _make_badge('__shape_test__')
        response = self.client.get(BADGE_CATALOG_URL)
        item = response.data['results'][0]
        assert set(item.keys()) == {'id', 'name', 'description', 'criteria_type', 'criteria_threshold'}

    def test_get_badge_catalog_new_badges_appear_at_end_ordered_by_id(self):
        b1 = _make_badge('__ord_a__')
        b2 = _make_badge('__ord_b__')
        # Use large page_size so all badges (seed + new) fit on one page.
        response = self.client.get(BADGE_CATALOG_URL, {'page_size': 100})
        ids = [r['id'] for r in response.data['results']]
        assert ids.index(b1.pk) < ids.index(b2.pk)
