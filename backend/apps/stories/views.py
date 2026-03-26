from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.stories.models import Story
from apps.stories.serializers import StorySerializer
from common.pagination import StoryPagination
from common.permissions import IsOwnerOrAdmin


class StoryListCreateView(generics.ListCreateAPIView):
    serializer_class = StorySerializer
    pagination_class = StoryPagination

    def get_queryset(self):
        # Guests and authenticated users can only browse published stories.
        # Draft and removed stories are not surfaced through this endpoint.
        return Story.objects.filter(status=Story.STATUS_PUBLISHED)

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class StoryDetailView(generics.RetrieveUpdateAPIView):
    queryset = Story.objects.all()
    serializer_class = StorySerializer
    http_method_names = ['get', 'patch']

    def get_permissions(self):
        if self.request.method == 'PATCH':
            return [IsOwnerOrAdmin()]
        return [AllowAny()]
