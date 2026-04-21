from django.db.models import Q

from apps.stories.models import Story


def create_story(user, validated_data: dict) -> Story:
    """Create and persist a new story owned by the given user."""
    return Story.objects.create(user=user, **validated_data)


def update_story(story: Story, validated_data: dict) -> Story:
    """Apply partial updates to an existing story and persist the changes."""
    for attr, value in validated_data.items():
        setattr(story, attr, value)
    story.save()
    return story


def delete_story(story: Story) -> None:
    """
    Permanently delete a story and all its related data.

    Cascades to media_items, likes, saved_by, and comments via FK CASCADE —
    no manual cleanup required. Permission enforcement is the caller's responsibility.
    """
    story.delete()


def get_story_feed(sort_by='recent', year_from=None, year_to=None, location=None):
    """
    Return a queryset of published stories with optional sorting and filtering.

    Time filtering spans all time_type variants — a story qualifies if any of
    its year fields falls within the requested range:
      - year_from: story's year >= year_from, OR year_end >= year_from (year_range stories)
      - year_to:   story's year <= year_to,   OR year_start <= year_to (year_range stories)

    Location filtering is a case-insensitive substring match on location_name so
    that partial queries like "galata" match "Galata Bridge".

    sort_by='popular' is reserved for when the interactions app provides like_count
    data. Until then only 'recent' is supported.
    """
    qs = Story.objects.filter(status=Story.STATUS_PUBLISHED)

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

    if sort_by == 'recent':
        qs = qs.order_by('-submitted_at')
        
    if sort_by == 'popular':
        qs = qs.order_by('-like_count')

    return qs


def get_story_search(q: str, sort_by='recent', year_from=None, year_to=None, location=None):
    """Return published stories whose title or location_name contains q (case-insensitive).

    Accepts the same optional filter params as get_story_feed so search results
    can be narrowed by year range and location in addition to the text query.

    Returns an empty queryset if q is blank or whitespace-only — callers should
    validate q before calling, but the service is safe to call directly.
    """
    if not q or not q.strip():
        return Story.objects.none()

    qs = (
        Story.objects
        .filter(status=Story.STATUS_PUBLISHED)
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

    if sort_by == 'recent':
        qs = qs.order_by('-submitted_at')

    # TODO: add sort_by='popular' ordered by like_count once interactions app is implemented

    return qs
