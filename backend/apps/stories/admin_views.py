from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import fields as drf_fields
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.stories.models import Story
from apps.stories.services import remove_story
from common.permissions import IsAdminUser


class _ModerationReasonSerializer(serializers.Serializer):
    moderation_reason = serializers.CharField(min_length=1)


def _error_response():
    return inline_serializer('StoryModerationValidationError', {
        'success': drf_fields.BooleanField(),
        'message': drf_fields.CharField(),
        'errors': drf_fields.DictField(),
    })


class AdminStoryRemovalView(APIView):
    """DELETE /moderation/stories/{id}/ — soft-remove a story (admin only)."""

    permission_classes = [IsAdminUser]

    @extend_schema(
        description='Requires admin privileges. Soft-removes the story with a moderation reason.',
        request={'application/json': _ModerationReasonSerializer},
        responses={204: None, 400: _error_response(), 404: _error_response()},
    )
    def delete(self, request, pk):
        serializer = _ModerationReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        story = get_object_or_404(Story, pk=pk)
        remove_story(story, serializer.validated_data['moderation_reason'])
        return Response(status=status.HTTP_204_NO_CONTENT)
