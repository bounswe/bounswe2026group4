from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.stories.models import Story
from apps.stories.serializers import FeedQuerySerializer, SearchQuerySerializer, StoryFeedSerializer, StorySerializer
from apps.stories.services import get_story_feed, get_story_search
from common.pagination import StoryPagination
from common.permissions import IsOwnerOrAdmin


class StoryFeedView(APIView):
    """
    GET /stories/feed/

    Returns a paginated list of published stories in card format.
    Guests and authenticated users both have read access.

    Query params:
      sort_by    — 'recent' (default) or 'popular'
      year_from  — include stories from this year onwards
      year_to    — include stories up to and including this year
      location   — case-insensitive substring match against location_name
      page       — page number (default 1)
      page_size  — results per page (default 10, max 100)
    """

    # Public endpoint — guests must be able to browse stories without logging in
    permission_classes = [AllowAny]

    def get(self, request):
        query_serializer = FeedQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        params = query_serializer.validated_data

        qs = get_story_feed(
            sort_by=params.get('sort_by', 'recent'),
            year_from=params.get('year_from'),
            year_to=params.get('year_to'),
            location=params.get('location'),
        )

        paginator = StoryPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = StoryFeedSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class StorySearchView(APIView):
    """
    GET /stories/search/?q=<query>

    Returns a paginated list of published stories matching the query against
    title and location_name. Open to guests and authenticated users alike.

    Query params:
      q — required, min 1 character after stripping whitespace
    """

    permission_classes = [AllowAny]

    def get(self, request):
        query_serializer = SearchQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        q = query_serializer.validated_data['q']

        qs = get_story_search(q)

        paginator = StoryPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = StoryFeedSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


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
