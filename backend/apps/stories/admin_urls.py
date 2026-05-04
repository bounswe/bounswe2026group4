from django.urls import path

from apps.stories.admin_views import AdminStoryRemovalView

urlpatterns = [
    path('stories/<int:pk>/', AdminStoryRemovalView.as_view(), name='admin-story-remove'),
]
