from django.urls import path

from apps.geocoding.views import GeocodeView, ReverseView, SuggestionsView

app_name = 'geocoding'

urlpatterns = [
    path('', GeocodeView.as_view(), name='geocode'),
    path('suggestions/', SuggestionsView.as_view(), name='geocode-suggestions'),
    path('reverse/', ReverseView.as_view(), name='geocode-reverse'),
]
