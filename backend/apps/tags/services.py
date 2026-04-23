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


def attach_tags_to_story(story, tag_ids: list) -> None:
    """
    Create StoryTag rows for any tag_ids not already linked to the story.
    story_count is incremented via the post_save signal on StoryTag.
    """
    from apps.tags.models import StoryTag

    existing_ids = set(story.story_tags.values_list('tag_id', flat=True))
    for tag_id in tag_ids:
        if tag_id not in existing_ids:
            StoryTag.objects.create(story=story, tag_id=tag_id)


def sync_story_tags(story, new_tag_ids: list) -> None:
    """
    Replace the story's full tag set with new_tag_ids.
    Removes tags no longer in the list and adds tags not yet linked.
    story_count adjustments happen via post_save/post_delete signals on StoryTag.
    """
    from apps.tags.models import StoryTag

    existing_ids = set(story.story_tags.values_list('tag_id', flat=True))
    new_ids = set(new_tag_ids)
    to_remove = existing_ids - new_ids
    to_add = new_ids - existing_ids
    if to_remove:
        StoryTag.objects.filter(story=story, tag_id__in=to_remove).delete()
    for tag_id in to_add:
        StoryTag.objects.create(story=story, tag_id=tag_id)
