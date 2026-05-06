from rest_framework import serializers

from apps.interactions.models import Comment, Like, SavedStory


class CommentCreateSerializer(serializers.Serializer):
    """Validates the body of a POST /stories/<id>/comments/ request."""

    text = serializers.CharField(allow_blank=False)


class CommentResponseSerializer(serializers.ModelSerializer):
    """Read-only representation of a Comment returned in API responses."""

    # Show username when author exists and comment is not anonymized; null otherwise.
    author_username = serializers.SerializerMethodField()
    # True when the requesting user is the comment author, regardless of username visibility.
    is_own_comment = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'story_id', 'author_username', 'text', 'is_anonymized', 'created_at', 'is_own_comment']

    def get_author_username(self, obj):
        if obj.is_anonymized or obj.author is None:
            return None
        if not obj.author.is_username_public:
            return None
        return obj.author.username

    def get_is_own_comment(self, obj):
        request = self.context.get('request')
        if request is None or not request.user.is_authenticated:
            return False
        return obj.author_id == request.user.id


class LikeResponseSerializer(serializers.ModelSerializer):
    """Read-only representation of a Like returned in API responses."""

    class Meta:
        model = Like
        fields = ['id', 'story_id', 'created_at']


class BookmarkResponseSerializer(serializers.ModelSerializer):
    """Read-only representation of a SavedStory returned in API responses."""

    class Meta:
        model = SavedStory
        fields = ['id', 'story_id', 'saved_at']
