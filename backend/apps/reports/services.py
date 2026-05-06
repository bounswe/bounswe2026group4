from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from apps.interactions.models import Comment
from apps.reports.models import Report, ReportReason
from apps.stories.models import Story
from django.shortcuts import get_object_or_404
from django.utils import timezone



def submit_report(reporter, target_type: str, target_id: int, reason: str, description: str = '') -> Report:
    if target_type == 'story':
        story = get_object_or_404(Story, pk=target_id)
        if story.status != Story.STATUS_PUBLISHED:
            raise ValidationError({'target_id': 'Cannot report this story.'})
        if story.user_id == reporter.pk:
            raise ValidationError({'target_id': 'You cannot report your own content.'})
        comment = None
    else:
        comment = get_object_or_404(Comment, pk=target_id)
        if comment.author_id == reporter.pk:
            raise ValidationError({'target_id': 'You cannot report your own content.'})
        story = None

    try:
        with transaction.atomic():
            return Report.objects.create(
                reporter=reporter,
                story=story,
                comment=comment,
                reason=reason,
                description=description,
            )
    except IntegrityError:
        raise ValidationError({'non_field_errors': ['You have already reported this content.']})



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
