from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.media.serializers import ImageUploadSerializer, MediaItemResponseSerializer
from apps.media.services import upload_story_image
from apps.stories.models import Story
from common.permissions import IsOwnerOrAdmin


class StoryImageUploadView(APIView):
    """POST /stories/<story_id>/images/ — upload an image to a story (owner only)."""

    # has_permission enforces authentication; has_object_permission enforces ownership.
    permission_classes = [IsOwnerOrAdmin]

    def post(self, request, story_id):
        # Fetch the story; removed stories are treated as non-existent.
        story = get_object_or_404(
            Story.objects.exclude(status=Story.STATUS_REMOVED),
            pk=story_id,
        )
        self.check_object_permissions(request, story)

        serializer = ImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        media_item = upload_story_image(story, serializer.validated_data['file'])

        return Response(
            {
                'message': 'Image uploaded successfully.',
                'image': MediaItemResponseSerializer(media_item, context={'request': request}).data,
            },
            status=status.HTTP_201_CREATED,
        )
