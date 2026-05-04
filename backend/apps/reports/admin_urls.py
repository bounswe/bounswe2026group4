from django.urls import path

from apps.reports.admin_views import AdminReportListView, AdminReportResolveView

urlpatterns = [
    path('reports/', AdminReportListView.as_view(), name='admin-report-list'),
    path('reports/<int:pk>/resolve/', AdminReportResolveView.as_view(), name='admin-report-resolve'),
]
