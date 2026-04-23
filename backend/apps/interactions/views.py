from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.interactions.models import Comment, Like, SavedStory
from apps.interactions.permissions import IsCommentAuthorOrAdmin
from apps.interactions.serializers import (
    BookmarkResponseSerializer,
    CommentCreateSerializer,
    CommentResponseSerializer,
    LikeResponseSerializer,
)
from apps.interactions.services import (
    add_bookmark,
    add_like,
    create_comment,
    delete_comment,
    get_story_comments,
    remove_bookmark,
    remove_like,
)
from common.pagination import StoryPagination
from common.permissions import IsRegisteredUser


class StoryCommentListCreateView(APIView):
    """
    GET  /stories/<story_id>/comments/ — list comments for a published story (public).
    POST /stories/<story_id>/comments/ — add a comment (registered users only).
    """

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsRegisteredUser()]
        return [AllowAny()]

    def get(self, request, story_id):
        qs = get_story_comments(story_id)
        paginator = StoryPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = CommentResponseSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

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


class StoryBookmarkView(APIView):
    """
    POST   /stories/<story_id>/bookmark/ — bookmark a published story.
    DELETE /stories/<story_id>/bookmark/ — remove an existing bookmark.
    Both require authentication.
    """

    permission_classes = [IsRegisteredUser]

    def post(self, request, story_id):
        bookmark, created = add_bookmark(request.user, story_id)
        http_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(
            {
                'message': 'Story bookmarked successfully.',
                'bookmark': BookmarkResponseSerializer(bookmark).data,
            },
            status=http_status,
        )

    def delete(self, request, story_id):
        remove_bookmark(request.user, story_id)
        return Response(status=status.HTTP_204_NO_CONTENT)
