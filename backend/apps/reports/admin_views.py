from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view, inline_serializer
from rest_framework import fields as drf_fields
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from common.pagination import StoryPagination
from common.permissions import IsAdminUser
from apps.reports.models import ReportStatus
from apps.reports.serializers import ReportSerializer, ReportResolveSerializer
from apps.reports.services import list_reports, resolve_report

_VALID_STATUSES = {s.value for s in ReportStatus}


def _error_response():
    return inline_serializer('ReportModerationValidationError', {
        'success': drf_fields.BooleanField(),
        'message': drf_fields.CharField(),
        'errors': drf_fields.DictField(),
    })


@extend_schema_view(
    get=extend_schema(
        description='Requires admin privileges. Returns a paginated list of all reports.',
        parameters=[
            OpenApiParameter('status', str, description='Filter by report status (e.g. pending, resolved)'),
        ],
    ),
)
class AdminReportListView(ListAPIView):
    """Return a paginated list of all reports, optionally filtered by status."""

    permission_classes = [IsAdminUser]
    serializer_class = ReportSerializer
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

    @extend_schema(
        description='Requires admin privileges. Marks the report as resolved with an optional note.',
        request={'application/json': ReportResolveSerializer},
        responses={200: ReportSerializer, 400: _error_response(), 404: _error_response()},
    )
    def patch(self, request, pk):
        serializer = ReportResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = resolve_report(
            report_id=pk,
            admin_user=request.user,
            resolution_note=serializer.validated_data['resolution_note'],
        )
        return Response(ReportSerializer(report).data, status=status.HTTP_200_OK)
