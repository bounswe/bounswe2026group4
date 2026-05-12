from django.http import Http404

from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.pagination import StoryPagination
from common.permissions import IsOwnerOrAdmin
from apps.gamification.serializers import (
    BadgeCatalogSerializer,
    PointSummarySerializer,
    PointTransactionSerializer,
    UserBadgeSerializer,
)
from apps.gamification.services import (
    get_badge_catalog,
    get_user_badges,
    get_user_point_history,
    get_user_points,
)
from apps.users.models import User


class UserPointsView(APIView):
    """GET /users/<user_id>/points/ — returns the user's total point balance."""

    permission_classes = [AllowAny]

    @extend_schema(
        description='Public. No authentication required.',
        responses={200: PointSummarySerializer},
    )
    def get(self, request, user_id):
        data = get_user_points(user_id)
        return Response(PointSummarySerializer(data).data)


class UserBadgesView(APIView):
    """GET /users/<user_id>/badges/ — paginated list of badges the user has earned."""

    permission_classes = [AllowAny]

    @extend_schema(
        description='Public. No authentication required.',
        responses={200: UserBadgeSerializer(many=True)},
    )
    def get(self, request, user_id):
        qs = get_user_badges(user_id)
        paginator = StoryPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(UserBadgeSerializer(page, many=True).data)


class UserPointHistoryView(APIView):
    """
    GET /users/<user_id>/point-history/ — paginated point transaction log.

    Only the account owner or an admin may view this — point breakdowns are private.
    check_object_permissions must be called explicitly because APIView does not
    call it automatically (unlike GenericAPIView with get_object()).
    """

    permission_classes = [IsOwnerOrAdmin]

    @extend_schema(
        description='Requires authentication (account owner or admin). Point breakdowns are private.',
        responses={200: PointTransactionSerializer(many=True)},
    )
    def get(self, request, user_id):
        try:
            target_user = User.objects.get(pk=user_id, is_active=True)
        except User.DoesNotExist:
            raise Http404
        self.check_object_permissions(request, target_user)
        qs = get_user_point_history(user_id)
        paginator = StoryPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(PointTransactionSerializer(page, many=True).data)


class BadgeCatalogView(APIView):
    """GET /gamification/badges/ — full catalog of all available badges."""

    permission_classes = [AllowAny]

    @extend_schema(
        description='Public. No authentication required.',
        responses={200: BadgeCatalogSerializer(many=True)},
    )
    def get(self, request):
        qs = get_badge_catalog()
        paginator = StoryPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(BadgeCatalogSerializer(page, many=True).data)
