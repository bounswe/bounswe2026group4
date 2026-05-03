from django.urls import path

from apps.gamification.views import (
    BadgeCatalogView,
    UserBadgesView,
    UserPointHistoryView,
    UserPointsView,
)

app_name = 'gamification'

urlpatterns = [
    path('users/<int:user_id>/points/', UserPointsView.as_view(), name='user-points'),
    path('users/<int:user_id>/badges/', UserBadgesView.as_view(), name='user-badges'),
    path('users/<int:user_id>/point-history/', UserPointHistoryView.as_view(), name='user-point-history'),
    path('gamification/badges/', BadgeCatalogView.as_view(), name='badge-catalog'),
]
