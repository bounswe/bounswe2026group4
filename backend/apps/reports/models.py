from django.conf import settings
from django.db import models


class ReportReason(models.TextChoices):
    SPAM = 'spam', 'Spam'
    FALSE_CONTENT = 'false_content', 'False/Misleading Content'
    HARASSMENT = 'harassment', 'Harassment or Abuse'
    PRIVACY_VIOLATION = 'privacy_violation', 'Privacy Violation'
    EXPLICIT_MEDIA = 'explicit_media', 'Explicit/Inappropriate Media'
    OTHER = 'other', 'Other'


class ReportStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    RESOLVED = 'resolved', 'Resolved'
    DISMISSED = 'dismissed', 'Dismissed'


class Report(models.Model):
    """
    User-submitted complaint about a story or a comment (req. 1.5).

    Two nullable FKs (story, comment) rather than a GenericForeignKey:
    - GenericForeignKey stores PKs as VARCHAR, losing referential integrity and JOIN support.
    - Two nullable FKs allow ON DELETE CASCADE, real database constraints, and the ORM to
      join directly: Report.objects.filter(story__author=user).select_related('story').
    - The "exactly one must be set" invariant is enforced in the serializer's validate().

    reporter is SET_NULL on account deletion to preserve the moderation history
    without exposing the deleted user's identity (req. 2.4.4).
    """

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='submitted_reports',
    )
    story = models.ForeignKey(
        'stories.Story',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='reports',
    )
    comment = models.ForeignKey(
        'interactions.Comment',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='reports',
    )
    reason = models.CharField(max_length=20, choices=ReportReason.choices)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=10,
        choices=ReportStatus.choices,
        default=ReportStatus.PENDING,
    )
    resolution_outcome = models.TextField(blank=True)
    # SET_NULL so the resolution record survives admin account deletion.
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_reports',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'reports'
        constraints = [
            # Prevent a user from submitting duplicate reports on the same target.
            # No condition= because MySQL doesn't support partial unique indexes —
            # it silently drops them. Plain UNIQUE(reporter, story) is safe here
            # because MySQL allows multiple NULLs in a unique index, so comment
            # reports (story=NULL) never collide with story reports (comment=NULL).
            models.UniqueConstraint(
                fields=['reporter', 'story'],
                name='unique_story_report',
            ),
            models.UniqueConstraint(
                fields=['reporter', 'comment'],
                name='unique_comment_report',
            ),
        ]
        indexes = [
            # Admin moderation queue: all pending reports sorted by date
            models.Index(fields=['status', 'created_at'], name='report_status_date_idx'),
        ]

    def __str__(self):
        target = f'Story({self.story_id})' if self.story_id else f'Comment({self.comment_id})'
        return f'Report({self.pk}) on {target} — {self.reason}'
