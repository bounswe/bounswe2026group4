from django.urls import path

from apps.tags.admin_views import AdminTagDeleteView

urlpatterns = [
    path('tags/<int:pk>/', AdminTagDeleteView.as_view(), name='admin-tag-delete'),
]
