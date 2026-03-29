from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.interactions.models import Comment
from apps.interactions.permissions import IsCommentAuthorOrAdmin
from apps.interactions.serializers import (
    CommentCreateSerializer,
    CommentResponseSerializer,
    LikeResponseSerializer,
)
from apps.interactions.services import add_like, create_comment, delete_comment, remove_like
from common.permissions import IsRegisteredUser


class StoryCommentCreateView(APIView):
    """POST /stories/<story_id>/comments/ — add a comment to a published story."""

    permission_classes = [IsRegisteredUser]

    def post(self, request, story_id):
        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = create_comment(request.user, story_id, serializer.validated_data['text'])
        return Response(
            {
                'message': 'Comment added successfully.',
                'comment': CommentResponseSerializer(comment).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CommentDeleteView(APIView):
    """DELETE /comments/<comment_id>/ — delete a comment (author or admin only)."""

    # has_permission enforces authentication; has_object_permission enforces ownership.
    permission_classes = [IsCommentAuthorOrAdmin]

    def delete(self, request, comment_id):
        comment = get_object_or_404(Comment, pk=comment_id)
        self.check_object_permissions(request, comment)
        delete_comment(comment)
        return Response(status=status.HTTP_204_NO_CONTENT)


class StoryLikeView(APIView):
    """
    POST   /stories/<story_id>/like/ — like a published story.
    DELETE /stories/<story_id>/like/ — remove an existing like.
    Both require authentication.
    """

    permission_classes = [IsRegisteredUser]

    def post(self, request, story_id):
        like = add_like(request.user, story_id)
        return Response(
            {
                'message': 'Story liked successfully.',
                'like': LikeResponseSerializer(like).data,
            },
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, story_id):
        remove_like(request.user, story_id)
        return Response(status=status.HTTP_204_NO_CONTENT)
