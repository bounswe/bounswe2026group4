from django.http import Http404

from apps.gamification.models import Badge, PointTransaction, UserBadge
from apps.users.models import User
from django.db import transaction
from django.db.models import F, Value
from django.db.models.functions import Greatest

from apps.gamification.constants import (
    BADGE_CRITERIA_POINTS_TOTAL,
    BADGE_CRITERIA_REGISTRATION,
    BADGE_CRITERIA_STORIES_PUBLISHED,
    POINT_VALUES,
)
from apps.gamification.models import Badge, PointTransaction, UserBadge


def _get_active_user(user_id):
    """Return the active User for user_id, or raise Http404 if absent or inactive."""
    try:
        return User.objects.get(pk=user_id, is_active=True)
    except User.DoesNotExist:
        raise Http404


def get_user_points(user_id):
    """Return a dict with the user's total point balance."""
    user = _get_active_user(user_id)
    return {'user_id': user.pk, 'total_points': user.total_points}


def get_user_badges(user_id):
    """Return all badges earned by the user, ordered by award date ascending."""
    _get_active_user(user_id)
    return (
        UserBadge.objects
        .filter(user_id=user_id)
        .select_related('badge')
        .order_by('awarded_at')
    )


def get_user_point_history(user_id):
    """Return the user's point transactions, ordered newest first."""
    _get_active_user(user_id)
    return (
        PointTransaction.objects
        .filter(user_id=user_id)
        .order_by('-created_at')
    )


def get_badge_catalog():
    """Return all available badges ordered by id."""
    return Badge.objects.all().order_by('id')


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

    # Badge check runs after the transaction commits so it reads the final
    # total_points and does not extend the point-recording lock duration.
    check_and_award_badges(user)


def check_and_award_badges(user):
    """
    Inspect all story-count and points-threshold badges and award any that the
    user has newly crossed. Idempotent — already-earned badges are skipped
    via a pre-fetched ID set, avoiding redundant INSERT attempts.

    Registration badges are excluded here; use award_registration_badge()
    at account-activation time instead.

    Query budget: 2 fixed SELECTs (all badges + earned IDs) + 1 INSERT per
    newly earned badge (usually 0 or 1 per call).
    """
    published_count = get_published_story_count(user)

    all_badges = list(Badge.objects.exclude(criteria_type=BADGE_CRITERIA_REGISTRATION))
    earned_ids = set(UserBadge.objects.filter(user=user).values_list('badge_id', flat=True))

    for badge in all_badges:
        if badge.pk in earned_ids:
            continue

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
    """Create a UserBadge row if not already awarded. The post_save signal fires
    only on creation (created=True), so notifications are sent exactly once."""
    UserBadge.objects.get_or_create(user=user, badge=badge)
