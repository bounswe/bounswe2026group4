from django.http import JsonResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.geocoding import services


class GeocodeView(APIView):
    """GET /geocode/?q=<place> — resolve a place name to a bounding box."""

    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[
            OpenApiParameter('q', str, required=True, description='Place name to resolve to a bounding box via Nominatim'),
        ]
    )
    def get(self, request):
        q = request.query_params.get('q', '')
        result = services.geocode_search(q)
        # JsonResponse(None, safe=False) serialises to JSON null; DRF Response(None) renders as empty body.
        return JsonResponse(result, safe=False)


class SuggestionsView(APIView):
    """GET /geocode/suggestions/?q=<partial> — autocomplete suggestions."""

    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[
            OpenApiParameter('q', str, required=True, description='Partial place name for autocomplete suggestions'),
        ]
    )
    def get(self, request):
        q = request.query_params.get('q', '')
        result = services.geocode_suggestions(q)
        return Response(result)


class ReverseView(APIView):
    """GET /geocode/reverse/?lat=<lat>&lng=<lng> — coords to place name."""

    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[
            OpenApiParameter('lat', float, required=True, description='WGS-84 latitude'),
            OpenApiParameter('lng', float, required=True, description='WGS-84 longitude'),
        ]
    )
    def get(self, request):
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        place_name = services.geocode_reverse(lat, lng)
        return Response({'place_name': place_name})
