from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import fields as drf_fields
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reports.serializers import ReportCreateSerializer, ReportResponseSerializer
from apps.reports.services import submit_report
from common.permissions import IsRegisteredUser


def _error_response():
    return inline_serializer('ReportValidationError', {
        'success': drf_fields.BooleanField(),
        'message': drf_fields.CharField(),
        'errors': drf_fields.DictField(),
    })


class ReportCreateView(APIView):
    """POST /reports/ — submit a report on a story or comment."""

    permission_classes = [IsRegisteredUser]

    @extend_schema(
        description='Requires authentication (registered user). Submit a report on a story or comment.',
        request={'application/json': ReportCreateSerializer},
        responses={201: ReportResponseSerializer, 400: _error_response()},
    )
    def post(self, request):
        serializer = ReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        report = submit_report(
            reporter=request.user,
            target_type=d['target_type'],
            target_id=d['target_id'],
            reason=d['reason'],
            description=d['description'],
        )
        return Response(ReportResponseSerializer(report).data, status=status.HTTP_201_CREATED)
