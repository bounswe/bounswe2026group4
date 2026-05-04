from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.stories.models import Story
from apps.stories.services import remove_story
from common.permissions import IsAdminUser


class _ModerationReasonSerializer(serializers.Serializer):
    moderation_reason = serializers.CharField(min_length=1)


class AdminStoryRemovalView(APIView):
    """DELETE /moderation/stories/{id}/ — soft-remove a story (admin only)."""

    permission_classes = [IsAdminUser]

    def delete(self, request, pk):
        serializer = _ModerationReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        story = get_object_or_404(Story, pk=pk)
        remove_story(story, serializer.validated_data['moderation_reason'])
        return Response(status=status.HTTP_204_NO_CONTENT)
