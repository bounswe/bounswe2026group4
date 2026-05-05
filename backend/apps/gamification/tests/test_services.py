from decimal import Decimal

import pytest
from django.http import Http404

from apps.gamification.constants import (
    BADGE_CRITERIA_POINTS_TOTAL,
    BADGE_CRITERIA_REGISTRATION,
    BADGE_CRITERIA_STORIES_PUBLISHED,
    STORY_LIKED,
    STORY_LIKE_REMOVED,
    STORY_PUBLISHED,
    STORY_REMOVED,
    USER_COMMENTED,
    USER_LIKED,
    USER_LIKE_REMOVED,
)
from apps.gamification.models import Badge, PointTransaction, UserBadge
from apps.gamification.services import (
    award_points,
    award_registration_badge,
    check_and_award_badges,
    get_badge_catalog,
    get_published_story_count,
    get_user_badges,
    get_user_point_history,
    get_user_points,
)
from apps.stories.models import Story
from apps.users.models import User


# ── Shared helpers ────────────────────────────────────────────────────────────

def _make_user(email='u@example.com', username='u', active=True):
    return User.objects.create_user(
        email=email, username=username, password='Password1', is_active=active,
    )


def _make_badge(name='Pioneer', criteria_type=BADGE_CRITERIA_STORIES_PUBLISHED, threshold=1):
    badge, _ = Badge.objects.get_or_create(
        name=name,
        defaults={
            'description': 'desc',
            'criteria_type': criteria_type,
            'criteria_threshold': threshold,
        },
    )
    return badge


def _make_story(user, status=Story.STATUS_PUBLISHED):
    return Story.objects.create(
        user=user, title='T', narrative='N',
        status=status,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='Place', time_type=Story.TIME_EXACT, year=2000,
    )


# ── get_user_points ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestGetUserPoints:
    def test_get_user_points_returns_user_id_and_total_points(self):
        user = _make_user()
        User.objects.filter(pk=user.pk).update(total_points=100)
        result = get_user_points(user.pk)
        assert result == {'user_id': user.pk, 'total_points': 100}

    def test_get_user_points_returns_zero_when_no_points(self):
        user = _make_user(email='zero@example.com', username='zero')
        result = get_user_points(user.pk)
        assert result['total_points'] == 0

    def test_get_user_points_nonexistent_user_raises_404(self):
        with pytest.raises(Http404):
            get_user_points(99999)

    def test_get_user_points_inactive_user_raises_404(self):
        user = _make_user(email='inactive@example.com', username='inactive', active=False)
        with pytest.raises(Http404):
            get_user_points(user.pk)


# ── get_user_badges ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestGetUserBadges:
    def setup_method(self):
        self.user = _make_user()

    def test_get_user_badges_returns_empty_queryset_when_none_earned(self):
        qs = get_user_badges(self.user.pk)
        assert qs.count() == 0

    def test_get_user_badges_returns_all_earned_badges(self):
        badge1 = _make_badge('__b1__')
        badge2 = _make_badge('__b2__')
        UserBadge.objects.create(user=self.user, badge=badge1)
        UserBadge.objects.create(user=self.user, badge=badge2)
        assert get_user_badges(self.user.pk).count() == 2

    def test_get_user_badges_ordered_by_awarded_at_ascending(self):
        badge1 = _make_badge('__ord1__')
        badge2 = _make_badge('__ord2__')
        ub1 = UserBadge.objects.create(user=self.user, badge=badge1)
        ub2 = UserBadge.objects.create(user=self.user, badge=badge2)
        results = list(get_user_badges(self.user.pk))
        assert results[0].pk == ub1.pk
        assert results[1].pk == ub2.pk

    def test_get_user_badges_does_not_return_other_users_badges(self):
        other = _make_user('other@example.com', 'other')
        badge = _make_badge('__other__')
        UserBadge.objects.create(user=other, badge=badge)
        assert get_user_badges(self.user.pk).count() == 0

    def test_get_user_badges_nonexistent_user_raises_404(self):
        with pytest.raises(Http404):
            get_user_badges(99999)

    def test_get_user_badges_inactive_user_raises_404(self):
        inactive = _make_user('inactive2@example.com', 'inactive2', active=False)
        with pytest.raises(Http404):
            get_user_badges(inactive.pk)


# ── get_user_point_history ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestGetUserPointHistory:
    def setup_method(self):
        self.user = _make_user()

    def test_get_user_point_history_returns_empty_when_none(self):
        qs = get_user_point_history(self.user.pk)
        assert qs.count() == 0

    def test_get_user_point_history_returns_all_transactions(self):
        PointTransaction.objects.create(user=self.user, amount=50, event_type=STORY_PUBLISHED)
        PointTransaction.objects.create(user=self.user, amount=2, event_type=STORY_LIKED)
        assert get_user_point_history(self.user.pk).count() == 2

    def test_get_user_point_history_ordered_newest_first(self):
        tx1 = PointTransaction.objects.create(user=self.user, amount=50, event_type=STORY_PUBLISHED)
        tx2 = PointTransaction.objects.create(user=self.user, amount=2, event_type=STORY_LIKED)
        results = list(get_user_point_history(self.user.pk))
        assert results[0].pk == tx2.pk
        assert results[1].pk == tx1.pk

    def test_get_user_point_history_does_not_return_other_users_transactions(self):
        other = _make_user('other2@example.com', 'other2')
        PointTransaction.objects.create(user=other, amount=50, event_type=STORY_PUBLISHED)
        assert get_user_point_history(self.user.pk).count() == 0

    def test_get_user_point_history_nonexistent_user_raises_404(self):
        with pytest.raises(Http404):
            get_user_point_history(99999)

    def test_get_user_point_history_inactive_user_raises_404(self):
        inactive = _make_user('inactive3@example.com', 'inactive3', active=False)
        with pytest.raises(Http404):
            get_user_point_history(inactive.pk)


# ── get_badge_catalog ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestGetBadgeCatalog:
    def test_get_badge_catalog_returns_seeded_badges(self):
        # Seed migration pre-populates the badge table; catalog must return all of them.
        seeded_count = Badge.objects.count()
        assert get_badge_catalog().count() == seeded_count

    def test_get_badge_catalog_adding_badge_increments_count(self):
        before = get_badge_catalog().count()
        _make_badge('__new_catalog_badge__')
        assert get_badge_catalog().count() == before + 1

    def test_get_badge_catalog_ordered_by_id_ascending(self):
        b1 = _make_badge('__cat_a__')
        b2 = _make_badge('__cat_b__')
        results = list(get_badge_catalog())
        ids = [b.pk for b in results]
        assert ids.index(b1.pk) < ids.index(b2.pk)


# ── award_points ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAwardPoints:
    def setup_method(self):
        self.user = _make_user()

    def test_award_points_creates_transaction(self):
        award_points(self.user, STORY_PUBLISHED)
        assert PointTransaction.objects.filter(user=self.user, event_type=STORY_PUBLISHED).exists()

    def test_award_points_stores_correct_amount(self):
        award_points(self.user, STORY_PUBLISHED)
        tx = PointTransaction.objects.get(user=self.user, event_type=STORY_PUBLISHED)
        assert tx.amount == 50

    def test_award_points_increments_total_points(self):
        award_points(self.user, STORY_PUBLISHED)
        self.user.refresh_from_db()
        assert self.user.total_points == 50

    def test_multiple_events_accumulate_points(self):
        award_points(self.user, STORY_PUBLISHED)
        award_points(self.user, STORY_LIKED)
        award_points(self.user, 'story_commented')
        self.user.refresh_from_db()
        assert self.user.total_points == 56  # 50 + 2 + 4

    def test_deduction_decreases_total_points(self):
        award_points(self.user, STORY_PUBLISHED)
        award_points(self.user, STORY_LIKE_REMOVED)
        self.user.refresh_from_db()
        assert self.user.total_points == 48

    def test_floor_prevents_points_going_below_zero(self):
        award_points(self.user, STORY_LIKE_REMOVED)
        self.user.refresh_from_db()
        assert self.user.total_points == 0

    def test_floor_clamps_partial_deduction_at_zero(self):
        award_points(self.user, STORY_LIKED)   # +2 → 2 total
        award_points(self.user, STORY_REMOVED) # -50 would go to -48; clamped to 0
        self.user.refresh_from_db()
        assert self.user.total_points == 0

    def test_award_points_links_story_to_transaction(self):
        story = _make_story(self.user)
        award_points(self.user, STORY_PUBLISHED, story=story)
        tx = PointTransaction.objects.get(user=self.user, event_type=STORY_PUBLISHED)
        assert tx.story_id == story.pk

    def test_award_points_without_story_is_valid(self):
        award_points(self.user, STORY_LIKED, story=None)
        tx = PointTransaction.objects.get(user=self.user, event_type=STORY_LIKED)
        assert tx.story is None

    def test_award_points_updates_user_instance_in_place(self):
        award_points(self.user, STORY_PUBLISHED)
        assert self.user.total_points == 50

    def test_award_points_triggers_badge_check(self):
        _make_badge('Fifty Points', BADGE_CRITERIA_POINTS_TOTAL, threshold=50)
        award_points(self.user, STORY_PUBLISHED)  # +50 → crosses threshold
        assert UserBadge.objects.filter(user=self.user).exists()

    def test_award_points_does_not_award_badge_below_threshold(self):
        badge = _make_badge('Century', BADGE_CRITERIA_POINTS_TOTAL, threshold=100)
        award_points(self.user, STORY_PUBLISHED)  # only 50 points
        assert not UserBadge.objects.filter(user=self.user, badge=badge).exists()

    def test_unknown_event_type_raises_key_error(self):
        with pytest.raises(KeyError):
            award_points(self.user, 'nonexistent_event')


# ── check_and_award_badges ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCheckAndAwardBadges:
    def setup_method(self):
        self.user = _make_user()

    def test_awards_stories_badge_at_exact_threshold(self):
        _make_badge('First Story', BADGE_CRITERIA_STORIES_PUBLISHED, threshold=1)
        _make_story(self.user)
        check_and_award_badges(self.user)
        assert UserBadge.objects.filter(user=self.user).count() == 1

    def test_does_not_award_stories_badge_below_threshold(self):
        badge = _make_badge('Three Stories', BADGE_CRITERIA_STORIES_PUBLISHED, threshold=3)
        _make_story(self.user)
        check_and_award_badges(self.user)
        assert not UserBadge.objects.filter(user=self.user, badge=badge).exists()

    def test_awards_points_badge_when_threshold_met(self):
        badge = _make_badge('Fifty Points', BADGE_CRITERIA_POINTS_TOTAL, threshold=50)
        self.user.total_points = 50
        self.user.save(update_fields=['total_points'])
        check_and_award_badges(self.user)
        assert UserBadge.objects.filter(user=self.user, badge=badge).exists()

    def test_does_not_award_points_badge_below_threshold(self):
        badge = _make_badge('Hundred Points', BADGE_CRITERIA_POINTS_TOTAL, threshold=100)
        self.user.total_points = 99
        self.user.save(update_fields=['total_points'])
        check_and_award_badges(self.user)
        assert not UserBadge.objects.filter(user=self.user, badge=badge).exists()

    def test_awards_multiple_badges_in_one_check(self):
        first_story_badge = _make_badge('First Story', BADGE_CRITERIA_STORIES_PUBLISHED, threshold=1)
        fifty_points_badge = _make_badge('Fifty Points', BADGE_CRITERIA_POINTS_TOTAL, threshold=50)
        _make_story(self.user)
        self.user.total_points = 50
        self.user.save(update_fields=['total_points'])
        check_and_award_badges(self.user)
        assert UserBadge.objects.filter(user=self.user, badge=first_story_badge).exists()
        assert UserBadge.objects.filter(user=self.user, badge=fifty_points_badge).exists()

    def test_idempotent_does_not_duplicate_badge(self):
        _make_badge('First Story', BADGE_CRITERIA_STORIES_PUBLISHED, threshold=1)
        _make_story(self.user)
        check_and_award_badges(self.user)
        check_and_award_badges(self.user)
        assert UserBadge.objects.filter(user=self.user).count() == 1

    def test_skips_registration_badges(self):
        _make_badge('Pioneer', BADGE_CRITERIA_REGISTRATION, threshold=0)
        check_and_award_badges(self.user)
        assert not UserBadge.objects.filter(user=self.user).exists()

    def test_draft_stories_do_not_count_toward_story_badge(self):
        _make_badge('First Story', BADGE_CRITERIA_STORIES_PUBLISHED, threshold=1)
        _make_story(self.user, status=Story.STATUS_DRAFT)
        check_and_award_badges(self.user)
        assert not UserBadge.objects.filter(user=self.user).exists()

    def test_removed_stories_do_not_count_toward_story_badge(self):
        _make_badge('First Story', BADGE_CRITERIA_STORIES_PUBLISHED, threshold=1)
        _make_story(self.user, status=Story.STATUS_REMOVED)
        check_and_award_badges(self.user)
        assert not UserBadge.objects.filter(user=self.user).exists()

    def test_no_badges_seeded_is_a_no_op(self):
        check_and_award_badges(self.user)
        assert UserBadge.objects.filter(user=self.user).count() == 0


# ── award_registration_badge ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestAwardRegistrationBadge:
    def setup_method(self):
        self.user = _make_user()

    def test_awards_registration_badge(self):
        _make_badge('Pioneer', BADGE_CRITERIA_REGISTRATION, threshold=0)
        award_registration_badge(self.user)
        assert UserBadge.objects.filter(user=self.user).exists()

    def test_idempotent_does_not_duplicate_badge(self):
        _make_badge('Pioneer', BADGE_CRITERIA_REGISTRATION, threshold=0)
        award_registration_badge(self.user)
        award_registration_badge(self.user)
        assert UserBadge.objects.filter(user=self.user).count() == 1

    def test_no_error_when_registration_badge_not_seeded(self):
        Badge.objects.filter(criteria_type=BADGE_CRITERIA_REGISTRATION).delete()
        award_registration_badge(self.user)
        assert UserBadge.objects.filter(user=self.user).count() == 0

    def test_does_not_award_non_registration_badges(self):
        _make_badge('Pioneer', BADGE_CRITERIA_REGISTRATION, threshold=0)
        _make_badge('First Story', BADGE_CRITERIA_STORIES_PUBLISHED, threshold=1)
        award_registration_badge(self.user)
        assert UserBadge.objects.filter(user=self.user).count() == 1
        awarded = UserBadge.objects.get(user=self.user)
        assert awarded.badge.criteria_type == BADGE_CRITERIA_REGISTRATION


# ── get_published_story_count ─────────────────────────────────────────────────

@pytest.mark.django_db
class TestGetPublishedStoryCount:
    def setup_method(self):
        self.user = _make_user()

    def test_returns_zero_for_user_with_no_stories(self):
        assert get_published_story_count(self.user) == 0

    def test_counts_published_stories(self):
        _make_story(self.user)
        _make_story(self.user)
        assert get_published_story_count(self.user) == 2

    def test_excludes_draft_stories(self):
        _make_story(self.user, status=Story.STATUS_DRAFT)
        assert get_published_story_count(self.user) == 0

    def test_excludes_removed_stories(self):
        _make_story(self.user, status=Story.STATUS_REMOVED)
        assert get_published_story_count(self.user) == 0

    def test_counts_only_own_stories(self):
        other = _make_user(email='other3@example.com', username='other3')
        _make_story(other)
        assert get_published_story_count(self.user) == 0

    def test_mixed_statuses_counted_correctly(self):
        _make_story(self.user, status=Story.STATUS_PUBLISHED)
        _make_story(self.user, status=Story.STATUS_DRAFT)
        _make_story(self.user, status=Story.STATUS_REMOVED)
        assert get_published_story_count(self.user) == 1
