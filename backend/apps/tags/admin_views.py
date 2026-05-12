from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdminUser

from .models import Tag
from .services import delete_tag


class AdminTagDeleteView(APIView):
    """DELETE /moderation/tags/{id}/ — remove a tag and all story associations (admin only)."""

    permission_classes = [IsAdminUser]

    @extend_schema(
        description='Requires admin privileges. Removes the tag and all story associations.',
        responses={204: None},
    )
    def delete(self, request, pk):
        tag = get_object_or_404(Tag, pk=pk)
        delete_tag(tag)
        return Response(status=status.HTTP_204_NO_CONTENT)
