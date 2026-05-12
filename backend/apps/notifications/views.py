from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import fields as drf_fields
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import Notification
from apps.notifications.serializers import (
    MarkReadSerializer,
    NotificationPreferencePatchSerializer,
    NotificationSerializer,
)
from apps.notifications.services import (
    delete_all_notifications,
    delete_notification,
    get_all_preferences,
    get_notifications,
    mark_notification_read,
    update_preferences,
)
from common.permissions import IsRegisteredUser


def _error_response():
    return inline_serializer('NotificationValidationError', {
        'success': drf_fields.BooleanField(),
        'message': drf_fields.CharField(),
        'errors': drf_fields.DictField(),
    })


class NotificationListView(APIView):
    """
    GET    /notifications/ — return the authenticated user's full notification inbox.
    DELETE /notifications/ — clear all notifications for the authenticated user.
    """

    permission_classes = [IsRegisteredUser]

    @extend_schema(
        description='Requires authentication (registered user). Returns the user\'s full notification inbox.',
        responses={200: inline_serializer('NotificationListResponse', {
            'notifications': NotificationSerializer(many=True),
        })},
    )
    def get(self, request):
        notifications = get_notifications(request.user)
        serializer = NotificationSerializer(notifications, many=True)
        return Response({'notifications': serializer.data})

    @extend_schema(
        description='Requires authentication (registered user). Clears all notifications.',
        responses={204: None},
    )
    def delete(self, request):
        delete_all_notifications(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationMarkReadView(APIView):
    """PATCH /notifications/<pk>/read/ — toggle the is_read flag on a single notification."""

    permission_classes = [IsRegisteredUser]

    @extend_schema(
        description='Requires authentication (registered user). Toggles is_read flag.',
        request={'application/json': MarkReadSerializer},
        responses={200: NotificationSerializer, 400: _error_response(), 404: _error_response()},
    )
    def patch(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, recipient=request.user)
        serializer = MarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notification = mark_notification_read(notification, serializer.validated_data['is_read'])
        return Response(NotificationSerializer(notification).data)


class NotificationDetailView(APIView):
    """DELETE /notifications/<pk>/ — delete a single notification."""

    permission_classes = [IsRegisteredUser]

    @extend_schema(
        description='Requires authentication (registered user). Deletes the notification.',
        responses={204: None, 404: _error_response()},
    )
    def delete(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, recipient=request.user)
        delete_notification(notification)
        return Response(status=status.HTTP_204_NO_CONTENT)


# Reusable schema for preference response so GET and PATCH share the same shape.
_PREFERENCE_RESPONSE = inline_serializer('NotificationPreferenceResponse', {
    'notifications_muted': drf_fields.BooleanField(),
    'preferences': drf_fields.DictField(),
})


class NotificationPreferenceView(APIView):
    """
    GET  /notifications/preferences/ — return the user's full preference state.
    PATCH /notifications/preferences/ — update global mute and/or per-type toggles.
    """

    permission_classes = [IsRegisteredUser]

    def _preference_response(self, user):
        return Response({
            'notifications_muted': user.notifications_muted,
            'preferences': get_all_preferences(user),
        })

    @extend_schema(
        description='Requires authentication (registered user). Returns the full notification preference state.',
        responses={200: _PREFERENCE_RESPONSE},
    )
    def get(self, request):
        return self._preference_response(request.user)

    @extend_schema(
        description='Requires authentication (registered user). Updates global mute and/or per-type toggles.',
        request={'application/json': NotificationPreferencePatchSerializer},
        responses={200: _PREFERENCE_RESPONSE, 400: _error_response()},
    )
    def patch(self, request):
        serializer = NotificationPreferencePatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        update_preferences(
            user=request.user,
            type_updates=serializer.get_type_updates(),
            notifications_muted=serializer.validated_data.get('notifications_muted'),
        )
        request.user.refresh_from_db(fields=['notifications_muted'])
        return self._preference_response(request.user)
