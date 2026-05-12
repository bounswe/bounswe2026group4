from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.interactions.models import Comment
from apps.interactions.services import delete_comment
from common.permissions import IsAdminUser


class AdminCommentRemovalView(APIView):
    """DELETE /moderation/comments/{id}/ — hard-delete a comment (admin only)."""

    permission_classes = [IsAdminUser]

    @extend_schema(
        description='Requires admin privileges. Hard-deletes the comment.',
        responses={204: None},
    )
    def delete(self, request, pk):
        comment = get_object_or_404(Comment, pk=pk)
        delete_comment(comment)
        return Response(status=status.HTTP_204_NO_CONTENT)
