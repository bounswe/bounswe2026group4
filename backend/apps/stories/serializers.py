from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.media.models import MediaItem, MediaType
from apps.stories.models import Story
from apps.stories.services import create_story, update_story
from apps.tags.models import Tag
from apps.tags.serializers import TagSerializer


class StorySerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    user_has_liked = serializers.SerializerMethodField()
    user_has_saved = serializers.SerializerMethodField()
    contributor_name = serializers.SerializerMethodField()

    # Write-only: list of existing Tag PKs to attach to the story.
    # Optional on create (defaults to no tags); optional on PATCH (absent = leave tags unchanged).
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        write_only=True,
        allow_empty=True,
    )
    # Read-only: tags currently linked to this story.
    tags = TagSerializer(many=True, read_only=True)

    class Meta:
        model = Story
        fields = [
            'id',
            'user',
            'contributor_name',
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
            'user_has_liked',
            'user_has_saved',
            'submitted_at',
            'updated_at',
            'tag_ids',
            'tags',
        ]
        read_only_fields = [
            'id',
            'user',
            'contributor_name',
            'like_count',
            'save_count',
            'user_has_liked',
            'user_has_saved',
            'submitted_at',
            'updated_at',
            'tags',
        ]

    def get_user_has_liked(self, obj):
        """Return True if the authenticated request user has liked this story, False otherwise.

        Reads the pre-computed _user_has_liked annotation when available (set by
        annotate_user_interactions in list views) to avoid an extra DB query per story.
        Falls back to a direct .exists() check for the single-object detail case.
        """
        if hasattr(obj, '_user_has_liked'):
            return obj._user_has_liked
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_user_has_saved(self, obj):
        """Return True if the authenticated request user has saved this story, False otherwise.

        Reads the pre-computed _user_has_saved annotation when available (set by
        annotate_user_interactions in list views) to avoid an extra DB query per story.
        Falls back to a direct .exists() check for the single-object detail case.
        """
        if hasattr(obj, '_user_has_saved'):
            return obj._user_has_saved
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.saved_by.filter(user=request.user).exists()
        return False
    def get_contributor_name(self, obj):
        """Return the author's username, or None if they have chosen to post anonymously."""
        if obj.contributor_visible and obj.user:
            return obj.user.username
        return None

    def validate_tag_ids(self, value):
        if len(value) > 3:
            raise serializers.ValidationError('A story may have at most 3 tags.')
        if len(value) != len(set(value)):
            raise serializers.ValidationError('Duplicate tag IDs are not allowed.')
        if value and Tag.objects.filter(pk__in=value).count() != len(value):
            raise serializers.ValidationError('One or more tag IDs do not exist.')
        return value

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


class StoryMediaItemSerializer(serializers.ModelSerializer):
    """Read-only serializer for media items embedded in the story detail response."""

    # Build an absolute URL when a request context is available so clients do
    # not need to know MEDIA_URL or the server hostname.
    url = serializers.SerializerMethodField()

    class Meta:
        model = MediaItem
        fields = ['id', 'url', 'media_type', 'order']
        read_only_fields = fields

    def get_url(self, obj):
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url


class StoryDetailSerializer(StorySerializer):
    """
    Extends StorySerializer with nested media items for GET /stories/<pk>/.

    Kept separate from StorySerializer so the list endpoint does not pay
    the cost of prefetching media on every paginated row.
    """

    media_items = StoryMediaItemSerializer(many=True, read_only=True)

    class Meta(StorySerializer.Meta):
        fields = StorySerializer.Meta.fields + ['media_items']
        read_only_fields = StorySerializer.Meta.read_only_fields + ['media_items']


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

    user_has_liked = serializers.SerializerMethodField()
    user_has_saved = serializers.SerializerMethodField()

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
            'user_has_liked',
            'user_has_saved',
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

    def get_user_has_liked(self, obj):
        """Return True if the authenticated request user has liked this story, False otherwise.

        Reads the pre-computed _user_has_liked annotation when available (set by
        annotate_user_interactions in list views) to avoid an extra DB query per story.
        Falls back to a direct .exists() check when the annotation is absent.
        """
        if hasattr(obj, '_user_has_liked'):
            return obj._user_has_liked
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_user_has_saved(self, obj):
        """Return True if the authenticated request user has saved this story, False otherwise.

        Reads the pre-computed _user_has_saved annotation when available (set by
        annotate_user_interactions in list views) to avoid an extra DB query per story.
        Falls back to a direct .exists() check when the annotation is absent.
        """
        if hasattr(obj, '_user_has_saved'):
            return obj._user_has_saved
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.saved_by.filter(user=request.user).exists()
        return False


class FeedQuerySerializer(serializers.Serializer):
    """
    Validates query parameters for the story feed endpoint.

    All fields are optional — omitting them returns the full published feed
    with default sort. year_from and year_to are validated together to ensure
    the range is logically consistent. latitude, longitude, and radius_km must
    all be provided together to enable radius filtering; supplying a partial set
    is rejected.
    """

    SORT_RECENT = 'recent'
    SORT_POPULAR = 'popular'
    SORT_CHOICES = [SORT_RECENT, SORT_POPULAR]

    sort_by = serializers.ChoiceField(choices=SORT_CHOICES, default=SORT_RECENT, required=False)
    year_from = serializers.IntegerField(required=False)
    year_to = serializers.IntegerField(required=False)
    # Substring match against location_name — partial values like "galata" are valid
    location = serializers.CharField(required=False, allow_blank=False)
    # Exact (case-insensitive) match against tag name — use the tag slug, e.g. "ottoman-era"
    tag = serializers.CharField(required=False, allow_blank=False)
    latitude = serializers.FloatField(required=False, min_value=-90.0, max_value=90.0)
    longitude = serializers.FloatField(required=False, min_value=-180.0, max_value=180.0)
    # Minimum of 0.001 km — a zero radius would always return empty results.
    # Maximum of 500 km — uncapped radius would force a full table scan into memory.
    radius_km = serializers.FloatField(required=False, min_value=0.001, max_value=500.0)

    def validate(self, data):
        year_from = data.get('year_from')
        year_to = data.get('year_to')
        if year_from is not None and year_to is not None and year_from > year_to:
            raise serializers.ValidationError(
                {'year_to': 'year_to must be greater than or equal to year_from.'}
            )

        geo_fields = {'latitude', 'longitude', 'radius_km'}
        provided = {k for k in geo_fields if data.get(k) is not None}
        if provided and provided != geo_fields:
            missing = geo_fields - provided
            raise serializers.ValidationError(
                {f: 'Required when performing radius filtering.' for f in missing}
            )

        return data


class StoryMapGeoJSONSerializer(serializers.BaseSerializer):
    """
    Serializes a Story as a GeoJSON Feature (RFC 7946).

    Coordinates follow the RFC 7946 §3.1.1 mandate: [longitude, latitude].
    Decimal fields are cast to float so the JSON encoder emits numeric values,
    not quoted decimal strings.

    BaseSerializer is used intentionally — we own the full output shape via
    to_representation, so ModelSerializer's field introspection is pure overhead.
    """

    def to_representation(self, instance):
        return {
            "type": "Feature",
            "id": instance.id,
            "geometry": {
                "type": "Point",
                # RFC 7946 §3.1.1: coordinate order is [longitude, latitude]
                "coordinates": [float(instance.location_lng), float(instance.location_lat)],
            },
            "properties": {
                "title": instance.title,
                "location_name": instance.location_name,
                "time_type": instance.time_type,
                "year": instance.year,
                "year_start": instance.year_start,
                "year_end": instance.year_end,
            },
        }


class SearchQuerySerializer(FeedQuerySerializer):
    """
    Validates query parameters for the story search endpoint.

    q is required. All filter params from FeedQuerySerializer (sort_by, year_from,
    year_to, location, tag, latitude, longitude, radius_km) are inherited so search
    results can be narrowed with the same filters as the feed.
    """

    # strip_whitespace=True (default) means a whitespace-only value becomes '' and fails min_length
    q = serializers.CharField(required=True, min_length=1)


class TimelineQuerySerializer(serializers.Serializer):
    """
    Validates query parameters for the story timeline endpoint.

    All fields are optional. year_from/year_to use interval-overlap semantics so
    decade and year_range stories are correctly included when their period intersects
    the requested window (see get_story_timeline service for details).

    lat_min/lat_max/lng_min/lng_max define a bounding box. All four must be
    supplied together or not at all.

    has_image=true restricts results to stories that have at least one image
    media item attached; omitting it returns all stories regardless of media.
    """

    year_from = serializers.IntegerField(required=False)
    year_to = serializers.IntegerField(required=False)
    lat_min = serializers.FloatField(required=False, min_value=-90.0, max_value=90.0)
    lat_max = serializers.FloatField(required=False, min_value=-90.0, max_value=90.0)
    lng_min = serializers.FloatField(required=False, min_value=-180.0, max_value=180.0)
    lng_max = serializers.FloatField(required=False, min_value=-180.0, max_value=180.0)
    has_image = serializers.BooleanField(required=False, allow_null=True, default=None)

    def validate(self, data):
        year_from = data.get('year_from')
        year_to = data.get('year_to')
        if year_from is not None and year_to is not None and year_from > year_to:
            raise serializers.ValidationError(
                {'year_to': 'year_to must be greater than or equal to year_from.'}
            )

        bbox_fields = {'lat_min', 'lat_max', 'lng_min', 'lng_max'}
        provided = {k for k in bbox_fields if data.get(k) is not None}
        if provided and provided != bbox_fields:
            missing = bbox_fields - provided
            raise serializers.ValidationError(
                {f: 'Required when performing bounding-box filtering.' for f in missing}
            )

        return data


class StoryTimelineSerializer(serializers.ModelSerializer):
    """
    Minimal read-only serializer for timeline cards.

    Returns only the fields needed to render a story on the timeline: identity,
    title, all time fields, coordinates, and a representative photo URL.
    Feed-specific fields (preview_text, contributor_name, like/save state,
    status, submitted_at) are intentionally excluded.
    """

    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Story
        fields = [
            'id',
            'title',
            'time_type',
            'year',
            'year_start',
            'year_end',
            'location_lat',
            'location_lng',
            'photo_url',
        ]
        read_only_fields = fields

    def get_photo_url(self, obj):
        """Return the URL of the first image MediaItem, or None if no image is attached."""
        request = self.context.get('request')
        for item in obj.media_items.all():
            if item.media_type == MediaType.IMAGE:
                if request:
                    return request.build_absolute_uri(item.file.url)
                return item.file.url
        return None
