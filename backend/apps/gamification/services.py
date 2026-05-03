from django.db import IntegrityError, transaction
from django.db.models import F, Value
from django.db.models.functions import Greatest

from apps.gamification.constants import (
    BADGE_CRITERIA_POINTS_TOTAL,
    BADGE_CRITERIA_REGISTRATION,
    BADGE_CRITERIA_STORIES_PUBLISHED,
    POINT_VALUES,
)
from apps.gamification.models import Badge, PointTransaction, UserBadge


def award_points(user, event_type, story=None):
    """
    Record a point event for the user and keep User.total_points consistent.

    Creates an immutable PointTransaction, updates the cached total atomically
    (floored at 0 — points never go negative), then checks badge eligibility.
    All writes happen inside a single transaction so the log and the cached
    total are never out of sync.
    """
    delta = POINT_VALUES[event_type]

    with transaction.atomic():
        PointTransaction.objects.create(
            user=user,
            amount=delta,
            event_type=event_type,
            story=story,
        )
        # Greatest(..., 0) enforces the floor at the database level, avoiding a
        # read-modify-write race under concurrent requests.
        type(user).objects.filter(pk=user.pk).update(
            total_points=Greatest(F('total_points') + delta, Value(0))
        )
        user.refresh_from_db(fields=['total_points'])
        check_and_award_badges(user)


def check_and_award_badges(user):
    """
    Inspect all story-count and points-threshold badges and award any that the
    user has newly crossed. Idempotent — the UserBadge unique constraint
    ensures already-earned badges are silently skipped.

    Registration badges are excluded here; use award_registration_badge()
    at account-activation time instead.
    """
    from apps.stories.models import Story

    published_count = get_published_story_count(user)

    for badge in Badge.objects.exclude(criteria_type=BADGE_CRITERIA_REGISTRATION):
        if badge.criteria_type == BADGE_CRITERIA_STORIES_PUBLISHED:
            earned = published_count >= badge.criteria_threshold
        elif badge.criteria_type == BADGE_CRITERIA_POINTS_TOTAL:
            earned = user.total_points >= badge.criteria_threshold
        else:
            earned = False

        if earned:
            _try_award_badge(user, badge)


def award_registration_badge(user):
    """Award the registration badge when a user completes account activation."""
    try:
        badge = Badge.objects.get(criteria_type=BADGE_CRITERIA_REGISTRATION)
    except Badge.DoesNotExist:
        return
    _try_award_badge(user, badge)


def get_published_story_count(user):
    """Return the number of published (non-removed, non-draft) stories owned by the user."""
    from apps.stories.models import Story

    return Story.objects.filter(user=user, status=Story.STATUS_PUBLISHED).count()


def _try_award_badge(user, badge):
    """Create a UserBadge row. Silently no-ops if the badge was already awarded."""
    try:
        with transaction.atomic():
            UserBadge.objects.create(user=user, badge=badge)
    except IntegrityError:
        pass
