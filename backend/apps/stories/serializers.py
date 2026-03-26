from rest_framework import serializers

from apps.stories.models import Story


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
