from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.users.views import LoginView, LogoutView, RegisterView

app_name = 'users'

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
]
