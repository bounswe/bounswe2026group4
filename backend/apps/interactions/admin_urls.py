from django.urls import path

from apps.interactions.admin_views import AdminCommentRemovalView

urlpatterns = [
    path('comments/<int:pk>/', AdminCommentRemovalView.as_view(), name='admin-comment-remove'),
]
