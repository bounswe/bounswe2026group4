from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.reports.models import Report, ReportStatus


def list_reports(status=None):
    """Return all reports ordered by newest first, optionally filtered by status."""
    qs = Report.objects.select_related('reporter', 'story', 'comment', 'resolved_by')
    if status:
        qs = qs.filter(status=status)
    return qs.order_by('-created_at')


def resolve_report(report_id, admin_user, resolution_note=''):
    """Set a report's status to RESOLVED, recording the admin and timestamp."""
    report = get_object_or_404(Report, pk=report_id)
    report.status = ReportStatus.RESOLVED
    report.resolved_by = admin_user
    report.resolved_at = timezone.now()
    report.resolution_outcome = resolution_note
    report.save()
    return report
