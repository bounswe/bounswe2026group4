from django.urls import path

from apps.media.views import StoryImageUploadView

app_name = 'media'

urlpatterns = [
    path('stories/<int:story_id>/images/', StoryImageUploadView.as_view(), name='story-image-upload'),
]
