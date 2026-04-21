import re

from django.db.models import QuerySet

from .models import Tag


def normalize_tag_name(name: str) -> str:
    """Lowercase, spaces/underscores→hyphens, drop non-alphanumeric, collapse hyphens."""
    name = name.strip().lower()
    name = re.sub(r'[\s_]+', '-', name)
    name = re.sub(r'[^a-z0-9\-]', '', name)
    name = re.sub(r'-{2,}', '-', name)
    return name.strip('-')


def list_tags(*, is_predefined=None, q=None) -> QuerySet:
    """
    Return Tag queryset with optional filters.
    is_predefined=True/False filters the flag; None returns all.
    q applies a case-insensitive name__icontains filter.
    Ordered by -story_count then name for autocomplete relevance.
    """
    qs = Tag.objects.all()
    if is_predefined is not None:
        qs = qs.filter(is_predefined=is_predefined)
    if q:
        qs = qs.filter(name__icontains=q)
    return qs.order_by('-story_count', 'name')


def create_tag(validated_data: dict, *, is_predefined: bool = False) -> tuple:
    """
    Create a tag if the normalized slug does not already exist.
    is_predefined is applied only on creation; an existing tag's flag is never overwritten.
    Returns (tag, created).
    """
    name = normalize_tag_name(validated_data['name'])
    tag, created = Tag.objects.get_or_create(
        name=name,
        defaults={'is_predefined': is_predefined},
    )
    return tag, created


def delete_tag(tag: Tag) -> None:
    """Delete the tag. StoryTag rows cascade via FK."""
    tag.delete()
