from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.stories.models import Story


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
        if value == Story.STATUS_REMOVED:
            raise serializers.ValidationError('Removed status can only be set by moderation.')
        return value

    def validate(self, attrs):
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
