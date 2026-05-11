from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.users.models import RoleChoices
from common.permissions import IsAdminUser, IsRegisteredUser

from .models import Tag
from .serializers import TagSerializer
from .services import create_tag, delete_tag, list_tags


@extend_schema_view(
    list=extend_schema(
        description='Public. No authentication required.',
        parameters=[
            OpenApiParameter('is_predefined', bool, description='Filter by predefined status'),
            OpenApiParameter('q', str, description='Search tags by name'),
        ],
    ),
    create=extend_schema(
        description='Requires authentication (registered user). Admins create predefined tags.',
        request={'application/json': TagSerializer},
    ),
)
class TagListCreateView(generics.ListCreateAPIView):
    """List existing tags with GET or create a new one with POST."""

    serializer_class = TagSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsRegisteredUser()]
        return [AllowAny()]

    def get_queryset(self):
        raw = self.request.query_params.get('is_predefined')
        flag = {'true': True, 'false': False}.get(raw)
        q = self.request.query_params.get('q', '').strip() or None
        return list_tags(is_predefined=flag, q=q)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        is_predefined = request.user.role == RoleChoices.ADMIN
        tag, created = create_tag(serializer.validated_data, is_predefined=is_predefined)
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(TagSerializer(tag).data, status=code)


@extend_schema_view(destroy=extend_schema(description='Requires admin privileges.'))
class TagDetailView(generics.DestroyAPIView):
    """Delete a tag by ID."""

    permission_classes = [IsAdminUser]
    queryset = Tag.objects.all()

    def perform_destroy(self, instance):
        delete_tag(instance)
