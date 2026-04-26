from django.urls import path

from apps.stories.views import StoryDetailView, StoryFeedView, StoryListCreateView, StoryMapView, StorySearchView, StoryTimelineView

app_name = 'stories'

urlpatterns = [
    path('', StoryListCreateView.as_view(), name='story-list-create'),
    path('feed/', StoryFeedView.as_view(), name='story-feed'),
    path('map/', StoryMapView.as_view(), name='story-map'),
    path('search/', StorySearchView.as_view(), name='story-search'),
    path('timeline/', StoryTimelineView.as_view(), name='story-timeline'),
    path('<int:pk>/', StoryDetailView.as_view(), name='story-detail'),
]
