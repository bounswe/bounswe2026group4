from django.urls import path

from apps.users.views import CurrentUserView, ProfilePhotoView, UserPublicProfileView

app_name = 'users_profile'

# Registered under 'users/' in config/urls.py.
# 'me/' is listed before '<int:user_id>/' as a matter of convention; Django's
# int converter already prevents 'me' from matching the parameterised route.
urlpatterns = [
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('me/photo/', ProfilePhotoView.as_view(), name='current-user-photo'),
    path('<int:user_id>/', UserPublicProfileView.as_view(), name='user-public-profile'),
]
