from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view, inline_serializer
from rest_framework import fields as drf_fields
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.stories.models import Story
from apps.stories.serializers import FeedQuerySerializer, SearchQuerySerializer, StoryDetailSerializer, StoryFeedSerializer, StoryMapGeoJSONSerializer, StorySerializer, StoryTimelineSerializer, TimelineQuerySerializer
from apps.stories.services import annotate_user_interactions, delete_story, get_story_feed, get_story_search, get_story_timeline
from common.pagination import StoryPagination
from common.permissions import IsOwnerOrAdmin


def apply_bbox_filters(qs, params):
    """Filter a Story queryset to those whose coordinates fall within the given bounding box."""
    if params.get('lat_min') is not None:
        qs = qs.filter(location_lat__gte=params['lat_min'])
    if params.get('lat_max') is not None:
        qs = qs.filter(location_lat__lte=params['lat_max'])
    if params.get('lng_min') is not None:
        qs = qs.filter(location_lng__gte=params['lng_min'])
    if params.get('lng_max') is not None:
        qs = qs.filter(location_lng__lte=params['lng_max'])
    return qs


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
      tags       — AND filter: repeat for each tag, e.g. "?tags=ottoman-era&tags=folklore"
      latitude   — WGS-84 latitude of user's position (-90 to 90)
      longitude  — WGS-84 longitude of user's position (-180 to 180)
      radius_km  — filter radius in kilometres (must be provided with latitude + longitude)
      lat_min    — minimum latitude of bounding box (optional)
      lat_max    — maximum latitude of bounding box (optional)
      lng_min    — minimum longitude of bounding box (optional)
      lng_max    — maximum longitude of bounding box (optional)
      page       — page number (default 1)
      page_size  — results per page (default 10, max 100)
    """

    # Public endpoint — guests must be able to browse stories without logging in
    permission_classes = [AllowAny]
    
    

    @extend_schema(
        parameters=[
            OpenApiParameter('sort_by', str, description="'recent' (default) or 'popular'"),
            OpenApiParameter('year_from', int, description='Include stories from this year onwards'),
            OpenApiParameter('year_to', int, description='Include stories up to and including this year'),
            OpenApiParameter('location', str, description='Case-insensitive substring match on location_name'),
            OpenApiParameter('tags', str, many=True, description='AND tag filter; repeat for each tag'),
            OpenApiParameter('latitude', float, description='WGS-84 latitude of the user\'s position'),
            OpenApiParameter('longitude', float, description='WGS-84 longitude of the user\'s position'),
            OpenApiParameter('radius_km', float, description='Filter radius in kilometres (requires latitude + longitude)'),
            OpenApiParameter('lat_min', float, description='Bounding box south edge'),
            OpenApiParameter('lat_max', float, description='Bounding box north edge'),
            OpenApiParameter('lng_min', float, description='Bounding box west edge'),
            OpenApiParameter('lng_max', float, description='Bounding box east edge'),
        ],
        responses=StoryFeedSerializer(many=True),
        description="Public. No authentication required.",
    )
    def get(self, request):
        query_serializer = FeedQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        params = query_serializer.validated_data

        qs = get_story_feed(
            sort_by=params.get('sort_by', 'recent'),
            year_from=params.get('year_from'),
            year_to=params.get('year_to'),
            location=params.get('location'),
            tags=params.get('tags'),
            latitude=params.get('latitude'),
            longitude=params.get('longitude'),
            radius_km=params.get('radius_km'),
        )

        qs = apply_bbox_filters(qs, params)

        if request.user.is_authenticated:
            qs = annotate_user_interactions(qs, request.user)

        paginator = StoryPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = StoryFeedSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class StoryMapView(APIView):
    """
    GET /stories/map/

    Returns all published stories as a GeoJSON FeatureCollection (RFC 7946).
    No pagination — map clients need the full set of pins in a single response.
    Each story is a Feature with a Point geometry and basic metadata in properties.

    Coordinates follow RFC 7946 §3.1.1: [longitude, latitude].

    Query params:
      year_from  — include stories from this year onwards
      year_to    — include stories up to and including this year
      location   — case-insensitive substring match against location_name
      tags       — AND filter: repeat for each tag, e.g. "?tags=ottoman-era&tags=folklore"
      latitude   — WGS-84 latitude of user's position (-90 to 90)
      longitude  — WGS-84 longitude of user's position (-180 to 180)
      radius_km  — filter radius in kilometres (must be provided with latitude + longitude)
      lat_min    — minimum latitude of bounding box (optional)
      lat_max    — maximum latitude of bounding box (optional)
      lng_min    — minimum longitude of bounding box (optional)
      lng_max    — maximum longitude of bounding box (optional)
    """

    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[
            OpenApiParameter('year_from', int, description='Include stories from this year onwards'),
            OpenApiParameter('year_to', int, description='Include stories up to and including this year'),
            OpenApiParameter('location', str, description='Case-insensitive substring match on location_name'),
            OpenApiParameter('tags', str, many=True, description='AND tag filter; repeat for each tag'),
            OpenApiParameter('latitude', float, description='WGS-84 latitude of the user\'s position'),
            OpenApiParameter('longitude', float, description='WGS-84 longitude of the user\'s position'),
            OpenApiParameter('radius_km', float, description='Filter radius in kilometres (requires latitude + longitude)'),
            OpenApiParameter('lat_min', float, description='Bounding box south edge'),
            OpenApiParameter('lat_max', float, description='Bounding box north edge'),
            OpenApiParameter('lng_min', float, description='Bounding box west edge'),
            OpenApiParameter('lng_max', float, description='Bounding box east edge'),
        ],
        responses={
            200: inline_serializer(
                name='GeoJSONFeatureCollection',
                fields={
                    'type': drf_fields.CharField(),
                    'features': drf_fields.ListField(child=drf_fields.DictField()),
                },
            )
        },
        description="Public. No authentication required.",
    )
    def get(self, request):
        query_serializer = FeedQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        params = query_serializer.validated_data

        qs = get_story_feed(
            year_from=params.get('year_from'),
            year_to=params.get('year_to'),
            location=params.get('location'),
            tags=params.get('tags'),
            latitude=params.get('latitude'),
            longitude=params.get('longitude'),
            radius_km=params.get('radius_km'),
        )
        
        qs = apply_bbox_filters(qs, params)

        serializer = StoryMapGeoJSONSerializer(qs, many=True)
        return Response({
            "type": "FeatureCollection",
            "features": serializer.data,
        })


class StorySearchView(APIView):
    """
    GET /stories/search/?q=<query>

    Returns a paginated list of published stories matching the query against
    title and location_name. Open to guests and authenticated users alike.

    Query params:
      q        — required, min 1 character after stripping whitespace
      tags     — AND filter: repeat for each tag, e.g. "?tags=ottoman-era&tags=folklore"
      lat_min   — minimum latitude of bounding box (optional)
      lat_max   — maximum latitude of bounding box (optional)
      lng_min   — minimum longitude of bounding box (optional)
      lng_max   — maximum longitude of bounding box (optional)
    """

    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[
            OpenApiParameter('q', str, required=True, description='Search query against title and location_name (min 1 char)'),
            OpenApiParameter('sort_by', str, description="'recent' (default) or 'popular'"),
            OpenApiParameter('year_from', int, description='Include stories from this year onwards'),
            OpenApiParameter('year_to', int, description='Include stories up to and including this year'),
            OpenApiParameter('location', str, description='Case-insensitive substring match on location_name'),
            OpenApiParameter('tags', str, many=True, description='AND tag filter; repeat for each tag'),
            OpenApiParameter('latitude', float, description='WGS-84 latitude of the user\'s position'),
            OpenApiParameter('longitude', float, description='WGS-84 longitude of the user\'s position'),
            OpenApiParameter('radius_km', float, description='Filter radius in kilometres (requires latitude + longitude)'),
            OpenApiParameter('lat_min', float, description='Bounding box south edge'),
            OpenApiParameter('lat_max', float, description='Bounding box north edge'),
            OpenApiParameter('lng_min', float, description='Bounding box west edge'),
            OpenApiParameter('lng_max', float, description='Bounding box east edge'),
        ],
        responses=StoryFeedSerializer(many=True),
        description="Public. No authentication required.",
    )
    def get(self, request):
        query_serializer = SearchQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        params = query_serializer.validated_data

        qs = get_story_search(
            q=params['q'],
            sort_by=params.get('sort_by', 'recent'),
            year_from=params.get('year_from'),
            year_to=params.get('year_to'),
            location=params.get('location'),
            tags=params.get('tags'),
            latitude=params.get('latitude'),
            longitude=params.get('longitude'),
            radius_km=params.get('radius_km'),
        )

        qs = apply_bbox_filters(qs, params)

        if request.user.is_authenticated:
            qs = annotate_user_interactions(qs, request.user)

        paginator = StoryPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = StoryFeedSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


@extend_schema_view(
    list=extend_schema(description='Public. No authentication required.'),
    create=extend_schema(
        description='Requires authentication (registered user).',
        request={'application/json': StorySerializer},
    ),
)
class StoryListCreateView(generics.ListCreateAPIView):
    serializer_class = StorySerializer
    pagination_class = StoryPagination

    def get_queryset(self):
        # Guests and authenticated users can only browse published stories.
        # Draft and removed stories are not surfaced through this endpoint.
        return Story.objects.filter(status=Story.STATUS_PUBLISHED).select_related('user').prefetch_related('tags')

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


@extend_schema_view(
    retrieve=extend_schema(description='Public. No authentication required.'),
    partial_update=extend_schema(
        description='Requires authentication (story owner or admin).',
        request={'application/json': StoryDetailSerializer},
    ),
    destroy=extend_schema(description='Requires authentication (story owner or admin).'),
)
class StoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Story.objects.select_related('user').prefetch_related('media_items', 'tags')
    serializer_class = StoryDetailSerializer
    http_method_names = ['get', 'patch', 'delete']

    def get_permissions(self):
        if self.request.method in ('PATCH', 'DELETE'):
            return [IsOwnerOrAdmin()]
        return [AllowAny()]

    def perform_destroy(self, instance):
        delete_story(instance)


class StoryTimelineView(APIView):
    """
    GET /stories/timeline/

    Returns a paginated list of published stories sorted by historical midpoint
    ascending (oldest first). Guests and authenticated users both have read access.

    Each result is a minimal timeline card: id, title, time fields, coordinates,
    and a representative photo_url. Feed-specific fields are omitted.

    Query params:
      year_from  — include stories whose time interval starts at or after this year
      year_to    — include stories whose time interval ends at or before this year
      lat_min    — bounding-box south edge (requires all four bbox params)
      lat_max    — bounding-box north edge
      lng_min    — bounding-box west edge
      lng_max    — bounding-box east edge
      has_image  — true: only stories with an image attached
      page       — page number (default 1)
      page_size  — results per page (default 10, max 100)
    """

    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[
            OpenApiParameter('year_from', int, description='Include stories whose interval starts at or after this year'),
            OpenApiParameter('year_to', int, description='Include stories whose interval ends at or before this year'),
            OpenApiParameter('tags', str, many=True, description='AND tag filter; repeat for each tag'),
            OpenApiParameter('latitude', float, description='WGS-84 latitude of the user\'s position'),
            OpenApiParameter('longitude', float, description='WGS-84 longitude of the user\'s position'),
            OpenApiParameter('radius_km', float, description='Filter radius in kilometres (requires latitude + longitude)'),
            OpenApiParameter('lat_min', float, description='Bounding box south edge'),
            OpenApiParameter('lat_max', float, description='Bounding box north edge'),
            OpenApiParameter('lng_min', float, description='Bounding box west edge'),
            OpenApiParameter('lng_max', float, description='Bounding box east edge'),
            OpenApiParameter('has_image', bool, description='If true, only return stories that have an image attached'),
        ],
        responses=StoryTimelineSerializer(many=True),
        description="Public. No authentication required.",
    )
    def get(self, request):
        query_serializer = TimelineQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        params = query_serializer.validated_data

        qs = get_story_timeline(
            year_from=params.get('year_from'),
            year_to=params.get('year_to'),
            lat_min=params.get('lat_min'),
            lat_max=params.get('lat_max'),
            lng_min=params.get('lng_min'),
            lng_max=params.get('lng_max'),
            has_image=params.get('has_image'),
            tags=params.get('tags'),
            latitude=params.get('latitude'),
            longitude=params.get('longitude'),
            radius_km=params.get('radius_km'),
        ).prefetch_related('media_items')

        paginator = StoryPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = StoryTimelineSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)
