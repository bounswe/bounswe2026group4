from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdminUser

from .models import User
from .serializers import UserBanResponseSerializer
from .services import ban_user


class AdminUserBanView(APIView):
    """PATCH /moderation/users/{id}/ban/ — disable a user account (admin only)."""

    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        target = get_object_or_404(User, pk=pk)
        banned = ban_user(target)
        return Response(UserBanResponseSerializer(banned).data, status=status.HTTP_200_OK)
