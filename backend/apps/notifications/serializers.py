from rest_framework import serializers

from apps.notifications.models import Notification
from apps.users.models import User


class NotificationActorSerializer(serializers.ModelSerializer):
    """Minimal actor representation — enough for the frontend to label who triggered the event."""

    class Meta:
        model = User
        fields = ['id', 'username']


class NotificationSerializer(serializers.ModelSerializer):
    """Read-only serializer for a single notification.

    story_id and comment_id are exposed directly so the frontend can navigate
    to the related content without extra requests (e.g. route to /stories/{story_id}/).
    """

    actor = NotificationActorSerializer(read_only=True)
    story_id = serializers.IntegerField(source='story.id', read_only=True, allow_null=True)
    comment_id = serializers.IntegerField(source='comment.id', read_only=True, allow_null=True)

    class Meta:
        model = Notification
        fields = [
            'id',
            'notification_type',
            'message',
            'actor',
            'story_id',
            'comment_id',
            'is_read',
            'created_at',
        ]
        read_only_fields = fields


class MarkReadSerializer(serializers.Serializer):
    """Validates the payload for the mark-read toggle endpoint."""

    is_read = serializers.BooleanField()
