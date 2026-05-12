from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import fields as drf_fields
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.interactions.models import Comment
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


def _error_response():
    return inline_serializer('InteractionValidationError', {
        'success': drf_fields.BooleanField(),
        'message': drf_fields.CharField(),
        'errors': drf_fields.DictField(),
    })


class StoryCommentListCreateView(APIView):
    """
    GET  /stories/<story_id>/comments/ — list comments for a published story (public).
    POST /stories/<story_id>/comments/ — add a comment (registered users only).
    """

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsRegisteredUser()]
        return [AllowAny()]

    @extend_schema(
        description='Public. No authentication required.',
        responses={200: CommentResponseSerializer(many=True)},
    )
    def get(self, request, story_id):
        qs = get_story_comments(story_id)
        paginator = StoryPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = CommentResponseSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        description='Requires authentication (registered user).',
        request={'application/json': CommentCreateSerializer},
        responses={
            201: inline_serializer('CommentCreateResponse', {
                'message': drf_fields.CharField(),
                'comment': CommentResponseSerializer(),
            }),
            400: _error_response(),
        },
    )
    def post(self, request, story_id):
        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = create_comment(request.user, story_id, serializer.validated_data['text'])
        return Response(
            {
                'message': 'Comment added successfully.',
                'comment': CommentResponseSerializer(comment, context={'request': request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CommentDeleteView(APIView):
    """DELETE /comments/<comment_id>/ — delete a comment (author or admin only)."""

    # has_permission enforces authentication; has_object_permission enforces ownership.
    permission_classes = [IsCommentAuthorOrAdmin]

    @extend_schema(
        description='Requires authentication (comment author or admin).',
        responses={204: None, 403: _error_response(), 404: _error_response()},
    )
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

    @extend_schema(
        description='Requires authentication (registered user). No request body needed.',
        request=None,
        responses={
            201: inline_serializer('LikeCreateResponse', {
                'message': drf_fields.CharField(),
                'like': LikeResponseSerializer(),
            }),
        },
    )
    def post(self, request, story_id):
        like = add_like(request.user, story_id)
        return Response(
            {
                'message': 'Story liked successfully.',
                'like': LikeResponseSerializer(like).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        description='Requires authentication (registered user).',
        responses={204: None},
    )
    def delete(self, request, story_id):
        remove_like(request.user, story_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class StoryBookmarkView(APIView):
    """
    POST   /stories/<story_id>/bookmark/ — bookmark a published story.
    DELETE /stories/<story_id>/bookmark/ — remove an existing bookmark.
    Both require authentication.

    POST returns 201 on creation, 200 if already bookmarked (idempotent).
    DELETE always returns 204 regardless of whether a bookmark existed.
    """

    permission_classes = [IsRegisteredUser]

    @extend_schema(
        description='Requires authentication (registered user). No request body needed. Idempotent: returns 200 if already bookmarked.',
        request=None,
        responses={
            201: inline_serializer('BookmarkCreateResponse', {
                'message': drf_fields.CharField(),
                'bookmark': BookmarkResponseSerializer(),
            }),
        },
    )
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

    @extend_schema(
        description='Requires authentication (registered user). Always returns 204 regardless of prior state.',
        responses={204: None},
    )
    def delete(self, request, story_id):
        remove_bookmark(request.user, story_id)
        return Response(status=status.HTTP_204_NO_CONTENT)
