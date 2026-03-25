from django.db.models import Q

from apps.stories.models import Story


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

    # TODO: add sort_by='popular' ordered by like_count once interactions app is implemented

    return qs
