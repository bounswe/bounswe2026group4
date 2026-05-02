from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reports.serializers import ReportCreateSerializer, ReportResponseSerializer
from apps.reports.services import submit_report
from common.permissions import IsRegisteredUser


class ReportCreateView(APIView):
    """POST /reports/ — submit a report on a story or comment."""

    permission_classes = [IsRegisteredUser]

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
