from django.urls import path

from apps.interactions.views import CommentDeleteView, StoryCommentCreateView, StoryLikeView

app_name = 'interactions'

urlpatterns = [
    path('stories/<int:story_id>/comments/', StoryCommentCreateView.as_view(), name='comment-create'),
    path('comments/<int:comment_id>/', CommentDeleteView.as_view(), name='comment-delete'),
    path('stories/<int:story_id>/like/', StoryLikeView.as_view(), name='story-like'),
]
