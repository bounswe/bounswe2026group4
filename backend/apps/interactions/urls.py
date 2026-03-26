from django.urls import path

from apps.interactions.views import CommentDeleteView, StoryCommentCreateView

app_name = 'interactions'

urlpatterns = [
    path('stories/<int:story_id>/comments/', StoryCommentCreateView.as_view(), name='comment-create'),
    path('comments/<int:comment_id>/', CommentDeleteView.as_view(), name='comment-delete'),
]
