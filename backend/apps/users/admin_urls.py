from django.urls import path

from apps.users.admin_views import AdminUserBanView

urlpatterns = [
    path('users/<int:pk>/ban/', AdminUserBanView.as_view(), name='admin-user-ban'),
]
