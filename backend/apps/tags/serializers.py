import re

from rest_framework import serializers

from .models import Tag


def _normalize_name(value: str) -> str:
    """
    Normalize a raw tag input into lowercase-with-hyphens slug format.
    Spaces and underscores become hyphens; non-alphanumeric characters are
    dropped; consecutive hyphens are collapsed; leading/trailing hyphens
    are stripped.
    """
    value = value.strip().lower()
    value = re.sub(r'[\s_]+', '-', value)
    value = re.sub(r'[^a-z0-9\-]', '', value)
    value = re.sub(r'-{2,}', '-', value)
    value = value.strip('-')
    return value


class TagSerializer(serializers.ModelSerializer):
    """Serializes Tag objects for list, create, and nested use."""

    class Meta:
        model = Tag
        fields = ['id', 'name', 'is_predefined', 'story_count']
        read_only_fields = ['id', 'is_predefined', 'story_count']
        # Duplicate detection is the service layer's responsibility (returns 200
        # for existing tags instead of 400), so we drop the auto-added UniqueValidator.
        extra_kwargs = {'name': {'validators': []}}

    def validate_name(self, value: str) -> str:
        normalized = _normalize_name(value)
        if not normalized:
            raise serializers.ValidationError(
                'Tag name is empty after normalization. Provide at least one alphanumeric character.'
            )
        # Delegate format enforcement to the model validator so the regex
        # is not duplicated here.
        tag = Tag(name=normalized)
        try:
            # validate_unique=False: duplicate detection is the service layer's job.
            tag.full_clean(exclude=['id'], validate_unique=False)
        except Exception as exc:
            # Surface only the name-related messages.
            raise serializers.ValidationError(
                exc.message_dict.get('name', [str(exc)])
            ) from exc
        return normalized
