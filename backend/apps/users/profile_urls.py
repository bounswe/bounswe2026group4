from django.urls import path

from apps.users.views import UserPublicProfileView

# Registered under 'users/' in config/urls.py, giving GET /users/{id}/.
# Kept separate from auth/users.urls to avoid namespace conflicts with the
# existing 'auth/' include.
urlpatterns = [
    path('<int:user_id>/', UserPublicProfileView.as_view(), name='user-public-profile'),
]
