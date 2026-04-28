from django.db.models.signals import pre_save
from django.dispatch import receiver

from apps.notifications.models import NotificationType
from apps.reports.models import Report, ReportStatus


@receiver(pre_save, sender=Report)
def on_report_resolved(sender, instance, **kwargs):
    """Notify the reporter when their report transitions out of pending.

    Fires on resolved and dismissed outcomes. Uses pre_save to compare against
    the persisted status so we only notify once on the first status transition.
    reporter is SET_NULL on account deletion; skip if no reporter remains.
    """
    if instance.pk is None or not instance.reporter:
        return
    if instance.status not in (ReportStatus.RESOLVED, ReportStatus.DISMISSED):
        return
    try:
        old_status = Report.objects.values_list('status', flat=True).get(pk=instance.pk)
    except Report.DoesNotExist:
        return
    if old_status != ReportStatus.PENDING:
        return  # already resolved/dismissed — no duplicate notification
    outcome = 'resolved' if instance.status == ReportStatus.RESOLVED else 'dismissed'
    from apps.notifications.services import create_notification
    create_notification(
        recipient=instance.reporter,
        notification_type=NotificationType.REPORT_RESOLVED,
        message=f'Your report has been {outcome}.',
    )
