from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class StoryStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    PUBLISHED = 'published', 'Published'
    REMOVED = 'removed', 'Removed'


class PeriodType(models.TextChoices):
    EXACT = 'exact', 'Exact Year'
    RANGE = 'range', 'Year Range'
    DECADE = 'decade', 'Decade'


class Story(models.Model):
    """
    Central content entity. Location and time period fields are embedded directly
    (rather than in separate related models) to avoid joins on every feed/map/timeline
    query — the 2-second SLA (req. 2.1.1) makes the join overhead worth eliminating.

    like_count and save_count are denormalized counters kept in sync via Django signals
    in the interactions app using F() expressions so increments are DB-atomic under
    concurrent requests (req. 2.1.3 — 100 concurrent users).

    author is SET_NULL on user deletion so stories are anonymized, not removed (req.
    1.1.2.11). The removal_reason field preserves moderation context (req. 1.4.3.3).
    """

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stories',
    )
    title = models.CharField(max_length=255)
    narrative_text = models.TextField()
    status = models.CharField(
        max_length=10,
        choices=StoryStatus.choices,
        default=StoryStatus.DRAFT,
    )
    removal_reason = models.TextField(blank=True)

    # ── Location fields (req. 1.3.1.1, 1.3.1.2) ──────────────────────────────
    # DECIMAL(9,6) / DECIMAL(10,6) are exact numeric types — avoids float rounding
    # in coordinate storage. Composite index enables bounding-box map queries without
    # the complexity of MySQL spatial extensions (GeoDjango + GDAL dependencies).
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=10, decimal_places=6)
    place_name = models.CharField(max_length=255)
    region = models.CharField(max_length=255, blank=True)

    # ── Time period fields (req. 1.4.1.2) ────────────────────────────────────
    # period_type is a discriminator. Mutual exclusivity is enforced in clean() and
    # must also be validated at the serializer layer.
    #   EXACT  → only start_year is meaningful
    #   RANGE  → start_year + end_year
    #   DECADE → decade (e.g. 1920 for "1920s")
    period_type = models.CharField(
        max_length=6,
        choices=PeriodType.choices,
        default=PeriodType.EXACT,
    )
    start_year = models.SmallIntegerField()
    end_year = models.SmallIntegerField(null=True, blank=True)
    decade = models.SmallIntegerField(null=True, blank=True)

    # ── Denormalized engagement counters (req. 1.3.2.4, 1.7.1.2) ────────────
    like_count = models.IntegerField(default=0)
    save_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'stories'
        indexes = [
            # Feed: published stories sorted by most recent
            models.Index(fields=['status', 'created_at'], name='story_status_date_idx'),
            # Feed: published stories sorted by most popular
            models.Index(fields=['status', 'like_count'], name='story_status_likes_idx'),
            # Map: bounding-box coordinate queries
            models.Index(fields=['latitude', 'longitude'], name='story_coords_idx'),
            # Timeline: filter/sort by year
            models.Index(fields=['start_year'], name='story_start_year_idx'),
            # Profile: user's own story list
            models.Index(fields=['author', 'status'], name='story_author_status_idx'),
        ]

    def clean(self):
        if self.period_type == PeriodType.RANGE and not self.end_year:
            raise ValidationError({'end_year': 'end_year is required for RANGE period type.'})
        if self.period_type == PeriodType.DECADE and not self.decade:
            raise ValidationError({'decade': 'decade is required for DECADE period type.'})

    def __str__(self):
        return self.title
