from django.db.models import Case, Exists, ExpressionWrapper, IntegerField, OuterRef, Q, When
from django.db.models.functions import Coalesce, ExtractYear

from apps.interactions.models import Like, SavedStory
from apps.media.models import MediaItem, MediaType
from apps.stories.models import Story


def annotate_user_interactions(qs, user):
    """
    Annotate a Story queryset with _user_has_liked and _user_has_saved boolean flags
    for the given authenticated user.

    Uses Exists subqueries so both checks are folded into the main SQL query,
    avoiding N+1 when serializing paginated lists.
    """
    return qs.annotate(
        _user_has_liked=Exists(Like.objects.filter(story=OuterRef('pk'), user=user)),
        _user_has_saved=Exists(SavedStory.objects.filter(story=OuterRef('pk'), user=user)),
    )


def create_story(user, validated_data: dict) -> Story:
    """Create and persist a new story owned by the given user."""
    from apps.tags.services import attach_tags_to_story

    tag_ids = validated_data.pop('tag_ids', [])
    story = Story.objects.create(user=user, **validated_data)
    if tag_ids:
        attach_tags_to_story(story, tag_ids)
    return story


def update_story(story: Story, validated_data: dict) -> Story:
    """Apply partial updates to an existing story and persist the changes."""
    from apps.tags.services import sync_story_tags

    # None means tag_ids was not provided in this PATCH — leave tags as-is.
    # An empty list means explicitly clear all tags.
    tag_ids = validated_data.pop('tag_ids', None)
    for attr, value in validated_data.items():
        setattr(story, attr, value)
    story.save()
    if tag_ids is not None:
        sync_story_tags(story, tag_ids)
    return story


def delete_story(story: Story) -> None:
    """
    Permanently delete a story and all its related data.

    Cascades to media_items, likes, saved_by, and comments via FK CASCADE —
    no manual cleanup required. Permission enforcement is the caller's responsibility.
    """
    story.delete()


def remove_story(story: Story, moderation_reason: str) -> None:
    """Soft-delete a story by setting its status to REMOVED and recording the moderation reason."""
    story.status = Story.STATUS_REMOVED
    story.moderation_reason = moderation_reason
    story.save(update_fields=['status', 'moderation_reason'])


def get_story_feed(
    sort_by='recent',
    year_from=None,
    year_to=None,
    location=None,
    tags=None,
    latitude=None,
    longitude=None,
    radius_km=None,
):
    """
    Return a queryset of published stories with optional sorting and filtering.

    Time filtering spans all time_type variants — a story qualifies if any of
    its year fields falls within the requested range:
      - year_from: story's year >= year_from, OR year_end >= year_from (year_range stories)
      - year_to:   story's year <= year_to,   OR year_start <= year_to (year_range stories)

    Location filtering is a case-insensitive substring match on location_name so
    that partial queries like "galata" match "Galata Bridge".

    When latitude, longitude, and radius_km are all provided, a two-step geo filter
    is applied: a DB bounding-box pre-filter (using the story_coords_idx index) narrows
    candidates, then an exact haversine check in Python discards bounding-box corners.
    The result remains a queryset (via pk__in) so annotate_user_interactions and
    paginator slicing continue to work without change.

    sort_by — 'recent' (default) orders by submission date; 'popular' orders by like_count
    """
    qs = Story.objects.filter(status=Story.STATUS_PUBLISHED).prefetch_related('tags')

    if year_from is not None:
        qs = qs.filter(
            Q(year__gte=year_from) |
            Q(year_end__gte=year_from)  # catches year_range stories that end within or after the window
        )

    if year_to is not None:
        qs = qs.filter(
            Q(year__lte=year_to) |
            Q(year_start__lte=year_to)  # catches year_range stories that start within or before the window
        )

    if location:
        qs = qs.filter(location_name__icontains=location)

    for tag in (tags or []):
        # Each chained filter is a separate JOIN — AND semantics: story must have ALL tags
        qs = qs.filter(story_tags__tag__name__iexact=tag)
    if tags:
        qs = qs.distinct()

    if latitude is not None and longitude is not None and radius_km is not None:
        qs = _apply_radius_filter(qs, latitude, longitude, radius_km)

    if sort_by == 'recent':
        qs = qs.order_by('-submitted_at')

    elif sort_by == 'popular':
        qs = qs.order_by('-like_count')

    return qs


def get_story_timeline(
    year_from=None,
    year_to=None,
    lat_min=None,
    lat_max=None,
    lng_min=None,
    lng_max=None,
    has_image=None,
):
    """
    Return published stories sorted by effective historical midpoint ascending.

    Sorting rules per time_type:
      exact_year / approximate_year → year
      decade                        → year + 5  (midpoint of the decade)
      year_range                    → (year_start + year_end) / 2

    year_from/year_to filtering uses interval-overlap semantics so that a decade
    or year_range story is included whenever its represented period intersects the
    requested window:
      exact / approx  — point value; must fall within [year_from, year_to]
      decade          — interval [year, year+9]; included if year+9 >= year_from
      year_range      — interval [year_start, year_end]; standard overlap rules

    lat_min/lat_max/lng_min/lng_max narrow results to a geographic bounding box.
    has_image=True restricts to stories that have at least one image MediaItem.
    """
    qs = Story.objects.filter(status=Story.STATUS_PUBLISHED)

    if year_from is not None:
        qs = qs.filter(
            # decade: interval ends at year+9; include if year+9 >= year_from ↔ year >= year_from-9
            Q(time_type=Story.TIME_DECADE, year__gte=year_from - 9) |
            # exact / approximate: point must be at or after year_from
            Q(time_type__in=[Story.TIME_EXACT, Story.TIME_APPROXIMATE], year__gte=year_from) |
            # year_range: interval ends at year_end; include if year_end >= year_from
            Q(time_type=Story.TIME_RANGE, year_end__gte=year_from) |
            # exact_date: compare by calendar year extracted from date_value
            Q(time_type=Story.TIME_DATE, date_value__year__gte=year_from)
        )

    if year_to is not None:
        # All non-range time types start at year; year_range starts at year_start.
        # Decade starts at year too (same as exact/approx), so no special case needed here.
        # exact_date has no year field — its date_value year is compared directly.
        qs = qs.filter(
            Q(year__lte=year_to) |
            Q(year_start__lte=year_to) |
            Q(time_type=Story.TIME_DATE, date_value__year__lte=year_to)
        )

    if lat_min is not None:
        qs = qs.filter(
            location_lat__gte=lat_min,
            location_lat__lte=lat_max,
            location_lng__gte=lng_min,
            location_lng__lte=lng_max,
        )

    if has_image is True:
        # Exists avoids the JOIN-based duplicates that would need .distinct(),
        # which conflicts with ORDER BY on an annotated column in MySQL.
        has_image_subq = MediaItem.objects.filter(
            story=OuterRef('pk'),
            media_type=MediaType.IMAGE,
        )
        qs = qs.filter(Exists(has_image_subq))

    # Build a synthetic sort key using the midpoint of each story's time interval.
    from django.db.models import F
    sort_key = Case(
        When(
            time_type=Story.TIME_RANGE,
            then=ExpressionWrapper(
                (F('year_start') + F('year_end')) / 2,
                output_field=IntegerField(),
            ),
        ),
        When(
            time_type=Story.TIME_DECADE,
            then=ExpressionWrapper(F('year') + 5, output_field=IntegerField()),
        ),
        When(
            time_type=Story.TIME_DATE,
            then=ExtractYear('date_value'),
        ),
        default=F('year'),
        output_field=IntegerField(),
    )
    return qs.annotate(historical_year=sort_key).order_by('historical_year', 'date_value')


def get_story_search(
    q: str,
    sort_by='recent',
    year_from=None,
    year_to=None,
    location=None,
    tags=None,
    latitude=None,
    longitude=None,
    radius_km=None,
):
    """Return published stories whose title or location_name contains q (case-insensitive).

    Accepts the same optional filter params as get_story_feed so search results
    can be narrowed by year range, location, tag, and radius in addition to the
    text query.

    Returns an empty queryset if q is blank or whitespace-only — callers should
    validate q before calling, but the service is safe to call directly.
    """
    if not q or not q.strip():
        return Story.objects.none()

    qs = (
        Story.objects
        .filter(status=Story.STATUS_PUBLISHED)
        .prefetch_related('tags')
        .filter(Q(title__icontains=q) | Q(location_name__icontains=q))
    )

    if year_from is not None:
        qs = qs.filter(
            Q(year__gte=year_from) |
            Q(year_end__gte=year_from)  # catches year_range stories that end within or after the window
        )

    if year_to is not None:
        qs = qs.filter(
            Q(year__lte=year_to) |
            Q(year_start__lte=year_to)  # catches year_range stories that start within or before the window
        )

    if location:
        qs = qs.filter(location_name__icontains=location)

    for tag in (tags or []):
        # Each chained filter is a separate JOIN — AND semantics: story must have ALL tags
        qs = qs.filter(story_tags__tag__name__iexact=tag)
    if tags:
        qs = qs.distinct()

    if latitude is not None and longitude is not None and radius_km is not None:
        qs = _apply_radius_filter(qs, latitude, longitude, radius_km)

    if sort_by == 'recent':
        qs = qs.order_by('-submitted_at')

    # TODO: add sort_by='popular' ordered by like_count once interactions app is implemented

    return qs


def _apply_radius_filter(qs, latitude: float, longitude: float, radius_km: float):
    """
    Narrow a Story queryset to stories within radius_km of (latitude, longitude).

    Uses a bounding-box DB pre-filter to leverage story_coords_idx, then a Python
    haversine pass to discard bounding-box corners. Returns a queryset (via pk__in)
    so the caller can continue chaining annotate, paginate, etc.
    """
    from common.utils.geo import bounding_box, haversine_km

    # NOTE: bounding_box clamps to ±180° — stories across the antimeridian are excluded.
    # This is acceptable for this project's geographic scope (Turkey / Istanbul area).
    bbox = bounding_box(latitude, longitude, radius_km)
    # .only() is safe after .distinct() (added by tag filter) — Django appends it to the
    # column selection, not to the DISTINCT key columns.
    candidates = qs.filter(
        location_lat__gte=bbox.lat_min,
        location_lat__lte=bbox.lat_max,
        location_lng__gte=bbox.lng_min,
        location_lng__lte=bbox.lng_max,
    ).only('pk', 'location_lat', 'location_lng')

    matching_ids = [
        story.pk
        for story in candidates
        if haversine_km(latitude, longitude, float(story.location_lat), float(story.location_lng)) <= radius_km
    ]
    return qs.filter(pk__in=matching_ids)
