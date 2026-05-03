from decimal import Decimal

import pytest

from apps.gamification.constants import (
    BADGE_CRITERIA_POINTS_TOTAL,
    BADGE_CRITERIA_REGISTRATION,
    BADGE_CRITERIA_STORIES_PUBLISHED,
    STORY_COMMENTED,
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
    get_published_story_count,
)
from apps.stories.models import Story
from apps.users.models import User


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_user(email='user@example.com', username='user'):
    return User.objects.create_user(email=email, username=username, password='Password1!')


def _make_story(user, status=Story.STATUS_PUBLISHED):
    return Story.objects.create(
        user=user, title='T', narrative='N',
        status=status,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='Place', time_type=Story.TIME_EXACT, year=2000,
    )


def _make_badge(name, criteria_type, threshold=0):
    return Badge.objects.create(
        name=name, description='desc',
        criteria_type=criteria_type, criteria_threshold=threshold,
    )


# ── award_points ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAwardPoints:
    def setup_method(self):
        self.user = _make_user()

    def test_award_points_creates_transaction(self):
        award_points(self.user, STORY_PUBLISHED)
        assert PointTransaction.objects.filter(user=self.user, event_type=STORY_PUBLISHED).exists()

    def test_award_points_stores_correct_amount(self):
        award_points(self.user, STORY_LIKED)
        tx = PointTransaction.objects.get(user=self.user, event_type=STORY_LIKED)
        assert tx.amount == 2

    def test_award_points_increments_total_points(self):
        award_points(self.user, STORY_PUBLISHED)
        self.user.refresh_from_db()
        assert self.user.total_points == 50

    def test_multiple_events_accumulate_points(self):
        award_points(self.user, STORY_PUBLISHED)
        award_points(self.user, STORY_LIKED)
        award_points(self.user, STORY_COMMENTED)
        self.user.refresh_from_db()
        assert self.user.total_points == 56  # 50 + 2 + 4

    def test_deduction_decreases_total_points(self):
        award_points(self.user, STORY_PUBLISHED)
        award_points(self.user, STORY_LIKE_REMOVED)
        self.user.refresh_from_db()
        assert self.user.total_points == 48

    def test_floor_prevents_points_going_below_zero(self):
        # User starts at 0; a deduction must not produce a negative total.
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
        # After the call the passed-in user object reflects the new total.
        award_points(self.user, STORY_PUBLISHED)
        assert self.user.total_points == 50

    def test_award_points_triggers_badge_check(self):
        # A points-threshold badge should be awarded after crossing its threshold.
        _make_badge('Fifty Points', BADGE_CRITERIA_POINTS_TOTAL, threshold=50)
        award_points(self.user, STORY_PUBLISHED)  # +50 → crosses threshold
        assert UserBadge.objects.filter(user=self.user).exists()

    def test_award_points_does_not_award_badge_below_threshold(self):
        _make_badge('Century', BADGE_CRITERIA_POINTS_TOTAL, threshold=100)
        award_points(self.user, STORY_PUBLISHED)  # only 50 points
        assert not UserBadge.objects.filter(user=self.user).exists()

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
        _make_badge('Three Stories', BADGE_CRITERIA_STORIES_PUBLISHED, threshold=3)
        _make_story(self.user)  # only 1 story
        check_and_award_badges(self.user)
        assert not UserBadge.objects.filter(user=self.user).exists()

    def test_awards_points_badge_when_threshold_met(self):
        _make_badge('Fifty Points', BADGE_CRITERIA_POINTS_TOTAL, threshold=50)
        self.user.total_points = 50
        self.user.save(update_fields=['total_points'])
        check_and_award_badges(self.user)
        assert UserBadge.objects.filter(user=self.user).exists()

    def test_does_not_award_points_badge_below_threshold(self):
        _make_badge('Hundred Points', BADGE_CRITERIA_POINTS_TOTAL, threshold=100)
        self.user.total_points = 99
        self.user.save(update_fields=['total_points'])
        check_and_award_badges(self.user)
        assert not UserBadge.objects.filter(user=self.user).exists()

    def test_awards_multiple_badges_in_one_check(self):
        _make_badge('First Story', BADGE_CRITERIA_STORIES_PUBLISHED, threshold=1)
        _make_badge('Fifty Points', BADGE_CRITERIA_POINTS_TOTAL, threshold=50)
        _make_story(self.user)
        self.user.total_points = 50
        self.user.save(update_fields=['total_points'])
        check_and_award_badges(self.user)
        assert UserBadge.objects.filter(user=self.user).count() == 2

    def test_idempotent_does_not_duplicate_badge(self):
        _make_badge('First Story', BADGE_CRITERIA_STORIES_PUBLISHED, threshold=1)
        _make_story(self.user)
        check_and_award_badges(self.user)
        check_and_award_badges(self.user)  # second call must not duplicate
        assert UserBadge.objects.filter(user=self.user).count() == 1

    def test_skips_registration_badges(self):
        # Registration badges must not be awarded through check_and_award_badges.
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
        # Should not raise even when the badge table is empty.
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
        award_registration_badge(self.user)  # second call must not duplicate
        assert UserBadge.objects.filter(user=self.user).count() == 1

    def test_no_error_when_registration_badge_not_seeded(self):
        # Graceful no-op when the badge row does not exist yet.
        award_registration_badge(self.user)  # must not raise
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
        other = _make_user(email='other@example.com', username='other')
        _make_story(other)
        assert get_published_story_count(self.user) == 0

    def test_mixed_statuses_counted_correctly(self):
        _make_story(self.user, status=Story.STATUS_PUBLISHED)
        _make_story(self.user, status=Story.STATUS_DRAFT)
        _make_story(self.user, status=Story.STATUS_REMOVED)
        assert get_published_story_count(self.user) == 1
