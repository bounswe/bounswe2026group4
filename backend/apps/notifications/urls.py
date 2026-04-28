from django.urls import path

from apps.notifications.views import (
    NotificationDetailView,
    NotificationListView,
    NotificationMarkReadView,
    NotificationPreferenceView,
)

app_name = 'notifications'

urlpatterns = [
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/preferences/', NotificationPreferenceView.as_view(), name='notification-preferences'),
    path('notifications/<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification-mark-read'),
    path('notifications/<int:pk>/', NotificationDetailView.as_view(), name='notification-detail'),
]
