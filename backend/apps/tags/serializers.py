from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Tag
from .services import normalize_tag_name


class TagSerializer(serializers.ModelSerializer):
    """Serializes Tag objects for list, create, and nested use."""

    class Meta:
        model = Tag
        fields = ['id', 'name', 'is_predefined', 'story_count']
        read_only_fields = ['id', 'is_predefined', 'story_count']
        # Duplicate detection is the service layer's responsibility (POST returns 200
        # for existing tags instead of 400), so we drop the auto-added UniqueValidator.
        extra_kwargs = {'name': {'validators': []}}

    def validate_name(self, value: str) -> str:
        normalized = normalize_tag_name(value)
        if not normalized:
            raise serializers.ValidationError(
                'Tag name is empty after normalization. Provide at least one alphanumeric character.'
            )
        # Delegate format enforcement to the model validator so the regex
        # is not duplicated here. validate_unique=False because the service
        # layer handles idempotent creation (get_or_create).
        tag = Tag(name=normalized)
        try:
            tag.full_clean(exclude=['id'], validate_unique=False)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict.get('name', exc.messages)) from exc
        return normalized
