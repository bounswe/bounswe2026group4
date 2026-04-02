from django.urls import path

from apps.interactions.views import CommentDeleteView, StoryCommentListCreateView, StoryLikeView

app_name = 'interactions'

urlpatterns = [
    path('stories/<int:story_id>/comments/', StoryCommentListCreateView.as_view(), name='comment-list-create'),
    path('comments/<int:comment_id>/', CommentDeleteView.as_view(), name='comment-delete'),
    path('stories/<int:story_id>/like/', StoryLikeView.as_view(), name='story-like'),
]
