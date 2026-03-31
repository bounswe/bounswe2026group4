from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.stories.models import Story
from apps.stories.services import create_story, update_story


class StorySerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Story
        fields = [
            'id',
            'user',
            'title',
            'narrative',
            'location_lat',
            'location_lng',
            'location_name',
            'region',
            'time_type',
            'year',
            'year_start',
            'year_end',
            'status',
            'contributor_visible',
            'like_count',
            'save_count',
            'submitted_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'user',
            'like_count',
            'save_count',
            'submitted_at',
            'updated_at',
        ]

    def validate_status(self, value):
        # Only moderation endpoints may set a story to removed — reject it here
        if value == Story.STATUS_REMOVED:
            raise serializers.ValidationError('Removed status can only be set by moderation.')
        return value

    def validate(self, attrs):
        # Build a temporary Story to run model-level clean() validation.
        # This catches time_type field consistency rules (e.g. year required for exact_year)
        # before any data reaches the database.
        instance = self.instance
        data = {
            'title': attrs.get('title', getattr(instance, 'title', None)),
            'narrative': attrs.get('narrative', getattr(instance, 'narrative', None)),
            'location_lat': attrs.get('location_lat', getattr(instance, 'location_lat', None)),
            'location_lng': attrs.get('location_lng', getattr(instance, 'location_lng', None)),
            'location_name': attrs.get('location_name', getattr(instance, 'location_name', None)),
            'region': attrs.get('region', getattr(instance, 'region', '')),
            'time_type': attrs.get('time_type', getattr(instance, 'time_type', None)),
            'year': attrs.get('year', getattr(instance, 'year', None)),
            'year_start': attrs.get('year_start', getattr(instance, 'year_start', None)),
            'year_end': attrs.get('year_end', getattr(instance, 'year_end', None)),
            'status': attrs.get('status', getattr(instance, 'status', Story.STATUS_PUBLISHED)),
            'contributor_visible': attrs.get(
                'contributor_visible',
                getattr(instance, 'contributor_visible', True),
            ),
            'user': getattr(instance, 'user', None),
        }

        story = Story(**data)
        try:
            story.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc

        return attrs

    def create(self, validated_data):
        user = validated_data.pop('user')
        return create_story(user=user, validated_data=validated_data)

    def update(self, instance, validated_data):
        return update_story(story=instance, validated_data=validated_data)


class StoryFeedSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for the story feed card format.

    Returns the fields needed to render a story card in the feed or search
    results — not the full narrative. contributor_name is derived from the
    story owner's username, but hidden when the user has opted for anonymity.
    preview_text is a truncated excerpt used as the card body copy.
    """

    # Derived from user.username, but only when the author has chosen to be visible.
    # Returns None when contributor_visible=False so the frontend can render "Anonymous".
    contributor_name = serializers.SerializerMethodField()

    # First 20 words of the narrative — enough context without loading the full text.
    preview_text = serializers.SerializerMethodField()

    class Meta:
        model = Story
        fields = [
            'id',
            'title',
            'location_name',
            'location_lat',
            'location_lng',
            'time_type',
            'year',
            'year_start',
            'year_end',
            'status',
            'contributor_name',
            'preview_text',
            'submitted_at',
        ]
        read_only_fields = fields

    def get_contributor_name(self, obj):
        """Return the author's username, or None if they have chosen to post anonymously."""
        if obj.contributor_visible and obj.user:
            return obj.user.username
        return None

    def get_preview_text(self, obj):
        """Return the first 20 words of the narrative as a short card excerpt."""
        words = obj.narrative.split()
        return ' '.join(words[:20])


class FeedQuerySerializer(serializers.Serializer):
    """
    Validates query parameters for the story feed endpoint.

    All fields are optional — omitting them returns the full published feed
    with default sort. year_from and year_to are validated together to ensure
    the range is logically consistent.
    """

    SORT_RECENT = 'recent'
    SORT_POPULAR = 'popular'
    SORT_CHOICES = [SORT_RECENT, SORT_POPULAR]

    sort_by = serializers.ChoiceField(choices=SORT_CHOICES, default=SORT_RECENT, required=False)
    year_from = serializers.IntegerField(required=False)
    year_to = serializers.IntegerField(required=False)
    # Substring match against location_name — partial values like "galata" are valid
    location = serializers.CharField(required=False, allow_blank=False)

    def validate(self, data):
        year_from = data.get('year_from')
        year_to = data.get('year_to')
        if year_from is not None and year_to is not None and year_from > year_to:
            raise serializers.ValidationError(
                {'year_to': 'year_to must be greater than or equal to year_from.'}
            )
        return data


class StoryMapSerializer(serializers.ModelSerializer):
    """
    Read-only serializer returning only the fields needed to render a map pin.

    Intentionally minimal — the map view only needs coordinates, place name,
    title, and time info to position a pin and show a preview tooltip.
    Full story content is loaded separately when a pin is clicked.
    """

    class Meta:
        model = Story
        fields = [
            'id',
            'title',
            'location_name',
            'location_lat',
            'location_lng',
            'time_type',
            'year',
            'year_start',
            'year_end',
        ]
        read_only_fields = fields


class SearchQuerySerializer(serializers.Serializer):
    """Validates the q query parameter for the story search endpoint."""

    # strip_whitespace=True (default) means a whitespace-only value becomes '' and fails min_length
    q = serializers.CharField(required=True, min_length=1)
