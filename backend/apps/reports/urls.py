from django.urls import path

from apps.reports.views import ReportCreateView

app_name = 'reports'

urlpatterns = [
    path('reports/', ReportCreateView.as_view(), name='report-create'),
]
