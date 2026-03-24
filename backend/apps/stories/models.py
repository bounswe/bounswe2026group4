from django.conf import settings
from django.db import models


class Story(models.Model):
    """A user-contributed historical narrative tied to a geographic location and time period."""

    # --- Status ---
    STATUS_PUBLISHED = 'published'
    STATUS_REMOVED = 'removed'
    STATUS_CHOICES = [
        (STATUS_PUBLISHED, 'Published'),
        (STATUS_REMOVED, 'Removed'),
    ]

    # --- Time resolution types ---
    # Stories can express time at different levels of precision.
    # exact_year:       story happened in a specific known year     → use `year`
    # approximate_year: year is an estimate, not a certain date     → use `year`
    # decade:           story is associated with a decade           → use `year` as the base (e.g. 1980 means "1980s")
    # year_range:       story spans multiple years                  → use `year_start` and `year_end`
    TIME_EXACT = 'exact_year'
    TIME_APPROXIMATE = 'approximate_year'
    TIME_DECADE = 'decade'
    TIME_RANGE = 'year_range'
    TIME_TYPE_CHOICES = [
        (TIME_EXACT, 'Exact Year'),
        (TIME_APPROXIMATE, 'Approximate Year'),
        (TIME_DECADE, 'Decade'),
        (TIME_RANGE, 'Year Range'),
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

    # Coordinates pin the story to an exact point on the map.
    location_lat = models.DecimalField(max_digits=9, decimal_places=6)
    location_lng = models.DecimalField(max_digits=9, decimal_places=6)
    # Human-readable name of the venue, building, or place — required alongside coordinates
    # because multiple distinct locations can share the same geographic point.
    location_name = models.CharField(max_length=255)

    time_type = models.CharField(max_length=20, choices=TIME_TYPE_CHOICES)
    # Holds the year value for exact_year, approximate_year, and the decade base (e.g. 1980 for "1980s").
    # Null for year_range stories, which use year_start and year_end instead.
    year = models.IntegerField(null=True, blank=True)
    year_start = models.IntegerField(null=True, blank=True)
    year_end = models.IntegerField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PUBLISHED,
    )
    # Stored alongside status so moderators can audit why a story was removed.
    moderation_reason = models.TextField(blank=True, default='')

    # Users can choose to post anonymously. When False, their username is hidden on the story page.
    contributor_visible = models.BooleanField(default=True)

    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stories'
        ordering = ['-submitted_at']

    def __str__(self):
        return self.title
