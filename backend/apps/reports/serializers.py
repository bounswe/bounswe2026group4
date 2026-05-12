from rest_framework import serializers

from apps.reports.models import Report, ReportReason


_TARGET_TYPE_CHOICES = [('story', 'Story'), ('comment', 'Comment')]


class ReportCreateSerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=_TARGET_TYPE_CHOICES)
    target_id = serializers.IntegerField(min_value=1)
    reason = serializers.ChoiceField(choices=ReportReason.choices)
    description = serializers.CharField(required=False, allow_blank=True, default='')


class ReportResponseSerializer(serializers.ModelSerializer):
    target_type = serializers.SerializerMethodField()
    target_id = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            'id',
            'target_type',
            'target_id',
            'reason',
            'status',
            'created_at',
        ]

    def get_target_type(self, obj):
        if obj.story_id:
            return 'story'
        if obj.comment_id:
            return 'comment'
        return None

    def get_target_id(self, obj):
        return obj.story_id or obj.comment_id


class _UserSummarySerializer(serializers.Serializer):
    """Minimal user representation used for reporter and resolved_by fields."""

    id = serializers.IntegerField()
    email = serializers.EmailField()
    username = serializers.CharField()


class ReportSerializer(serializers.ModelSerializer):
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
        if obj.story_id:
            return 'story'
        if obj.comment_id:
            return 'comment'
        return None

    def get_target_id(self, obj):
        return obj.story_id or obj.comment_id


class ReportResolveSerializer(serializers.Serializer):
    """Validates the optional resolution note on the resolve endpoint."""

    resolution_note = serializers.CharField(allow_blank=True, required=False, default='')