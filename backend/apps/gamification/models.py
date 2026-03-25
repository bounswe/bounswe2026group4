from django.conf import settings
from django.db import models

from apps.gamification.constants import (
    BADGE_CRITERIA_POINTS_TOTAL,
    BADGE_CRITERIA_REGISTRATION,
    BADGE_CRITERIA_STORIES_PUBLISHED,
    POINT_VALUES,
)


class Badge(models.Model):
    """
    Platform-defined achievement (req. 1.7.2). Rows are seeded via a data
    migration or management command — not created by users.

    criteria_type + criteria_threshold together define when the badge is
    awarded so the gamification service can check eligibility without
    hard-coded if/else chains.
    """

    CRITERIA_CHOICES = [
        (BADGE_CRITERIA_REGISTRATION, 'Registration'),
        (BADGE_CRITERIA_STORIES_PUBLISHED, 'Stories Published'),
        (BADGE_CRITERIA_POINTS_TOTAL, 'Total Points'),
    ]

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField()
    criteria_type = models.CharField(max_length=20, choices=CRITERIA_CHOICES)
    # threshold=0 means "any" — used for the registration badge
    criteria_threshold = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'badges'

    def __str__(self):
        return self.name


class UserBadge(models.Model):
    """
    Records that a specific user has earned a specific badge (req. 1.7.2).
    Unique constraint prevents awarding the same badge twice.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='user_badges',
    )
    badge = models.ForeignKey(
        Badge,
        on_delete=models.CASCADE,
        related_name='user_badges',
    )
    awarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_badges'
        constraints = [
            models.UniqueConstraint(fields=['user', 'badge'], name='unique_user_badge'),
        ]

    def __str__(self):
        return f'{self.user_id} earned {self.badge.name}'


class PointTransaction(models.Model):
    """
    Immutable audit log of every point event for a user (req. 1.7.1).

    WHY a transaction log alongside User.total_points (hybrid approach):
    - User.total_points is a cached total for O(1) reads on profile pages and
      leaderboard queries — no SUM() needed.
    - PointTransaction is the source of truth for history ("why do I have X points?")
      and enables monthly/period leaderboards.
    - Both are updated together inside a transaction.atomic() block in the
      gamification service, so they are always consistent.

    amount is signed: positive = earned, negative = deducted (rescinded actions).
    story is SET_NULL if the story is deleted so the transaction history is preserved.
    """

    EVENT_TYPE_CHOICES = [(k, k) for k in POINT_VALUES]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='point_transactions',
    )
    amount = models.SmallIntegerField()
    event_type = models.CharField(max_length=30, choices=EVENT_TYPE_CHOICES)
    story = models.ForeignKey(
        'stories.Story',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='point_transactions',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'point_transactions'
        indexes = [
            # User's point history feed, sorted chronologically
            models.Index(fields=['user', 'created_at'], name='pointtx_user_date_idx'),
        ]

    def __str__(self):
        sign = '+' if self.amount >= 0 else ''
        return f'PointTx({self.user_id}: {sign}{self.amount} for {self.event_type})'
