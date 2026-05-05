from rest_framework import serializers

from apps.reports.models import Report


class _UserSummarySerializer(serializers.Serializer):
    """Minimal user representation used for reporter and resolved_by fields."""

    id = serializers.IntegerField()
    email = serializers.EmailField()
    username = serializers.CharField()


class ReportListSerializer(serializers.ModelSerializer):
    """Read-only serializer for the admin report list and resolve response."""

    reporter = _UserSummarySerializer(read_only=True)
    resolved_by = _UserSummarySerializer(read_only=True)
    target_type = serializers.SerializerMethodField()
    target_id = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            'id',
            'reporter',
            'target_type',
            'target_id',
            'reason',
            'description',
            'status',
            'created_at',
            'resolved_at',
            'resolution_outcome',
            'resolved_by',
        ]

    def get_target_type(self, obj):
        return 'story' if obj.story_id else 'comment'

    def get_target_id(self, obj):
        return obj.story_id if obj.story_id else obj.comment_id


class ReportResolveSerializer(serializers.Serializer):
    """Validates the optional resolution note on the resolve endpoint."""

    resolution_note = serializers.CharField(allow_blank=True, required=False, default='')
