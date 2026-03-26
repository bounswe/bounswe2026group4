from django.urls import path

from apps.stories.views import StoryFeedView

app_name = 'stories'

urlpatterns = [
    path('feed/', StoryFeedView.as_view(), name='story-feed'),
]
