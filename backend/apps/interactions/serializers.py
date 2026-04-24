from rest_framework import serializers

from apps.interactions.models import Comment, Like


class CommentCreateSerializer(serializers.Serializer):
    """Validates the body of a POST /stories/<id>/comments/ request."""

    text = serializers.CharField(allow_blank=False)


class CommentResponseSerializer(serializers.ModelSerializer):
    """Read-only representation of a Comment returned in API responses."""

    # Show username when author exists and comment is not anonymized; null otherwise.
    author_username = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'story_id', 'author_username', 'text', 'is_anonymized', 'created_at']

    def get_author_username(self, obj):
        if obj.is_anonymized or obj.author is None:
            return None
        if not obj.author.is_username_public:
            return None
        return obj.author.username


class LikeResponseSerializer(serializers.ModelSerializer):
    """Read-only representation of a Like returned in API responses."""

    class Meta:
        model = Like
        fields = ['id', 'story_id', 'created_at']
