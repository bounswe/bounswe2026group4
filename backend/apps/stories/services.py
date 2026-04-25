from django.db.models import Exists, OuterRef, Q

from apps.interactions.models import Like, SavedStory
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


def get_story_feed(sort_by='recent', year_from=None, year_to=None, location=None, tag=None):
    """
    Return a queryset of published stories with optional sorting and filtering.

    Time filtering spans all time_type variants — a story qualifies if any of
    its year fields falls within the requested range:
      - year_from: story's year >= year_from, OR year_end >= year_from (year_range stories)
      - year_to:   story's year <= year_to,   OR year_start <= year_to (year_range stories)

    Location filtering is a case-insensitive substring match on location_name so
    that partial queries like "galata" match "Galata Bridge".

    sort_by — 'recent' (default) orders by submission date; 'popular' orders by like_count
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

    if tag:
        qs = qs.filter(story_tags__tag__name__iexact=tag).distinct()

    if sort_by == 'recent':
        qs = qs.order_by('-submitted_at')
        
    elif sort_by == 'popular':
        qs = qs.order_by('-like_count')

    return qs


def get_story_search(q: str, sort_by='recent', year_from=None, year_to=None, location=None, tag=None):
    """Return published stories whose title or location_name contains q (case-insensitive).

    Accepts the same optional filter params as get_story_feed so search results
    can be narrowed by year range, location, and tag in addition to the text query.

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

    if tag:
        qs = qs.filter(story_tags__tag__name__iexact=tag).distinct()

    if sort_by == 'recent':
        qs = qs.order_by('-submitted_at')

    # TODO: add sort_by='popular' ordered by like_count once interactions app is implemented

    return qs
