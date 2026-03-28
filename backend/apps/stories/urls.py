from django.urls import path

from apps.stories.views import StoryDetailView, StoryFeedView, StoryListCreateView, StorySearchView

app_name = 'stories'

urlpatterns = [
    path('', StoryListCreateView.as_view(), name='story-list-create'),
    path('<int:pk>/', StoryDetailView.as_view(), name='story-detail'),
    path('feed/', StoryFeedView.as_view(), name='story-feed'),
    path('search/', StorySearchView.as_view(), name='story-search'),
]
