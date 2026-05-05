from rest_framework import serializers

from apps.gamification.models import Badge, PointTransaction, UserBadge


class BadgeCatalogSerializer(serializers.ModelSerializer):
    """Read-only serializer for a single Badge row — used in the catalog and nested in UserBadgeSerializer."""

    class Meta:
        model = Badge
        fields = ['id', 'name', 'description', 'criteria_type', 'criteria_threshold']
        read_only_fields = fields


class UserBadgeSerializer(serializers.ModelSerializer):
    """Read-only serializer for a user's earned badge entry, with the badge details nested inline."""

    badge = BadgeCatalogSerializer(read_only=True)

    class Meta:
        model = UserBadge
        fields = ['id', 'badge', 'awarded_at']
        read_only_fields = fields


class PointSummarySerializer(serializers.Serializer):
    """Serializes the point balance for a user. Accepts a plain dict, not a model instance."""

    user_id = serializers.IntegerField(read_only=True)
    total_points = serializers.IntegerField(read_only=True)


class PointTransactionSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for a single point transaction.

    story_id exposes the raw FK integer column directly — avoids AttributeError when the story FK is null,
    matching the pattern used in NotificationSerializer for nullable FK columns.
    """

    story_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = PointTransaction
        fields = ['id', 'amount', 'event_type', 'story_id', 'created_at']
        read_only_fields = fields
