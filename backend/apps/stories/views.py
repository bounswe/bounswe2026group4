from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.stories.models import Story
from apps.stories.serializers import StorySerializer
from common.permissions import IsOwnerOrAdmin


class StoryListCreateView(generics.ListCreateAPIView):
    queryset = Story.objects.all()
    serializer_class = StorySerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)


class StoryDetailView(generics.RetrieveUpdateAPIView):
    queryset = Story.objects.all()
    serializer_class = StorySerializer
    http_method_names = ['get', 'patch']

    def get_permissions(self):
        if self.request.method == 'PATCH':
            return [IsOwnerOrAdmin()]
        return [AllowAny()]
