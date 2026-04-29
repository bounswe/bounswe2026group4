from rest_framework import serializers

from apps.notifications.models import Notification, NotificationType
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

    actor = NotificationActorSerializer(read_only=True, allow_null=True)
    # Read the raw FK integer column directly — avoids AttributeError when the FK is null.
    story_id = serializers.IntegerField(read_only=True, allow_null=True)
    comment_id = serializers.IntegerField(read_only=True, allow_null=True)

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


_VALID_TYPES = set(NotificationType.values)


class NotificationPreferencePatchSerializer(serializers.Serializer):
    """Validates PATCH /notifications/preferences/ — accepts global mute and/or per-type toggles."""

    notifications_muted = serializers.BooleanField(required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for nt in NotificationType.values:
            self.fields[nt] = serializers.BooleanField(required=False)

    def get_type_updates(self):
        """Return only the per-type fields from validated data, excluding notifications_muted."""
        return {
            k: v for k, v in self.validated_data.items()
            if k in _VALID_TYPES
        }
