from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from common.pagination import StoryPagination
from common.permissions import IsAdminUser
from apps.reports.models import ReportStatus
from apps.reports.serializers import ReportListSerializer, ReportResolveSerializer
from apps.reports.services import list_reports, resolve_report

_VALID_STATUSES = {s.value for s in ReportStatus}


class AdminReportListView(ListAPIView):
    """Return a paginated list of all reports, optionally filtered by status."""

    permission_classes = [IsAdminUser]
    serializer_class = ReportListSerializer
    pagination_class = StoryPagination

    def get_queryset(self):
        status_param = self.request.query_params.get('status')
        if status_param and status_param not in _VALID_STATUSES:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'status': f"Invalid status. Choose from: {', '.join(sorted(_VALID_STATUSES))}."})
        return list_reports(status=status_param)


class AdminReportResolveView(APIView):
    """Mark a report as resolved, recording the admin and an optional note."""

    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        serializer = ReportResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = resolve_report(
            report_id=pk,
            admin_user=request.user,
            resolution_note=serializer.validated_data['resolution_note'],
        )
        return Response(ReportListSerializer(report).data, status=status.HTTP_200_OK)
