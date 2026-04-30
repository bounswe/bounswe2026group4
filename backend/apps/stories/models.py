from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Story(models.Model):
    """A user-contributed historical narrative tied to a geographic location and time period."""

    # --- Status ---
    STATUS_DRAFT = 'draft'
    STATUS_PUBLISHED = 'published'
    STATUS_REMOVED = 'removed'
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_PUBLISHED, 'Published'),
        (STATUS_REMOVED, 'Removed'),
    ]

    # --- Time resolution types ---
    # Stories can express time at different levels of precision.
    # exact_year:       story happened in a specific known year   → populate `year`
    # approximate_year: year is an estimate, not a certain date   → populate `year`
    # decade:           story is tied to a decade                 → populate `year` as the decade base (e.g. 1980 for "1980s")
    # year_range:       story spans multiple years                → populate `year_start` and `year_end`
    # exact_date:       story happened on a known calendar date   → populate `date_value`; optionally `time_value` for minute precision
    TIME_EXACT = 'exact_year'
    TIME_APPROXIMATE = 'approximate_year'
    TIME_DECADE = 'decade'
    TIME_RANGE = 'year_range'
    TIME_DATE = 'exact_date'
    TIME_TYPE_CHOICES = [
        (TIME_EXACT, 'Exact Year'),
        (TIME_APPROXIMATE, 'Approximate Year'),
        (TIME_DECADE, 'Decade'),
        (TIME_RANGE, 'Year Range'),
        (TIME_DATE, 'Exact Date'),
    ]

    # SET_NULL so that deleting a user account anonymizes their stories instead of removing them.
    # Stories are community content and should outlive the account that submitted them.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name='stories',
    )

    title = models.CharField(max_length=255)
    narrative = models.TextField()

    # DECIMAL is used over float to avoid rounding errors in coordinate storage.
    # Longitude needs max_digits=10 to cover the full value range including negatives like -100.123456.
    location_lat = models.DecimalField(max_digits=9, decimal_places=6)
    location_lng = models.DecimalField(max_digits=10, decimal_places=6)
    # Human-readable name of the venue, building, or place — required alongside coordinates
    # because multiple distinct locations can share the same geographic point.
    location_name = models.CharField(max_length=255)
    # Optional broader region (city, district) to support location-based filtering without
    # requiring a full coordinate bounding-box query.
    region = models.CharField(max_length=255, blank=True)

    time_type = models.CharField(max_length=20, choices=TIME_TYPE_CHOICES)
    # Populated for exact_year, approximate_year, and decade (e.g. 1980 means "1980s").
    # Left null for year_range and exact_date stories.
    year = models.SmallIntegerField(null=True, blank=True)
    year_start = models.SmallIntegerField(null=True, blank=True)
    year_end = models.SmallIntegerField(null=True, blank=True)
    # Populated for exact_date stories. time_value is optional (minute precision).
    date_value = models.DateField(null=True, blank=True)
    time_value = models.TimeField(null=True, blank=True)

    # DRAFT is available for future draft-saving UX.
    # REMOVED is set by moderation with an accompanying moderation_reason.
    # Default is PUBLISHED because the story submission service will set status explicitly.
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PUBLISHED,
    )
    # Stored alongside status so moderators can audit why a story was removed.
    moderation_reason = models.TextField(blank=True, default='')

    # Users can choose to post anonymously. When False, their username is hidden on the story page.
    contributor_visible = models.BooleanField(default=True)

    # Explicit through-table; ManyToManyField added here for ORM convenience (prefetch_related,
    # story.tags.all()). The DB schema (story_tags table) is owned by the tags app.
    tags = models.ManyToManyField(
        'tags.Tag',
        through='tags.StoryTag',
        related_name='stories',
        blank=True,
    )

    # Denormalized counters kept in sync via signals in the interactions app.
    # Avoids expensive COUNT aggregates on every feed and profile page load.
    # Increments must use F() expressions to stay DB-atomic under concurrent requests.
    like_count = models.IntegerField(default=0)
    save_count = models.IntegerField(default=0)

    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'stories'
        ordering = ['-submitted_at']
        indexes = [
            # Feed: published stories sorted by submission date (sort_by=recent)
            models.Index(fields=['status', 'submitted_at'], name='story_status_date_idx'),
            # Feed: published stories sorted by engagement (sort_by=popular)
            models.Index(fields=['status', 'like_count'], name='story_status_likes_idx'),
            # Map: bounding-box coordinate queries
            models.Index(fields=['location_lat', 'location_lng'], name='story_coords_idx'),
            # Timeline: filter and sort stories by year
            models.Index(fields=['year'], name='story_year_idx'),
            # Profile: list a user's own stories filtered by status
            models.Index(fields=['user', 'status'], name='story_user_status_idx'),
        ]

    def clean(self):
        """Enforce that the correct year fields are populated for the selected time_type."""
        if self.time_type == self.TIME_RANGE:
            if not self.year_start:
                raise ValidationError({'year_start': 'year_start is required for year_range.'})
            if not self.year_end:
                raise ValidationError({'year_end': 'year_end is required for year_range.'})
        elif self.time_type in (self.TIME_EXACT, self.TIME_APPROXIMATE, self.TIME_DECADE):
            if self.year is None:
                raise ValidationError({'year': f'year is required for {self.time_type}.'})
        elif self.time_type == self.TIME_DATE:
            if self.date_value is None:
                raise ValidationError({'date_value': 'date_value is required for exact_date.'})

    def __str__(self):
        return self.title
