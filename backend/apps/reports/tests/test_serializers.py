from decimal import Decimal

import pytest

from apps.interactions.models import Comment
from apps.reports.models import Report, ReportReason, ReportStatus
from apps.reports.serializers import ReportListSerializer, ReportResolveSerializer
from apps.stories.models import Story
from apps.users.models import RoleChoices, User


def _make_user(email='user@example.com', username='user', role=RoleChoices.REGISTERED_USER):
    return User.objects.create_user(
        email=email, username=username, password='Password1', is_active=True, role=role,
    )


def _make_story(user):
    return Story.objects.create(
        user=user, title='T', narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='P', time_type=Story.TIME_EXACT, year=2000,
    )


@pytest.mark.django_db
class TestReportListSerializer:
    def setup_method(self):
        self.reporter = _make_user('reporter@example.com', 'reporter')
        self.author = _make_user('author@example.com', 'author')
        self.admin = _make_user('admin@example.com', 'admin', role=RoleChoices.ADMIN)
        self.story = _make_story(self.author)
        self.comment = Comment.objects.create(
            story=self.story, author=self.author, text='A comment.',
        )

    def test_story_report_serializes_all_fields(self):
        report = Report.objects.create(
            reporter=self.reporter, story=self.story, reason=ReportReason.SPAM,
        )
        data = ReportListSerializer(report).data
        assert data['id'] == report.pk
        assert data['target_type'] == 'story'
        assert data['target_id'] == self.story.pk
        assert data['reason'] == ReportReason.SPAM
        assert data['status'] == ReportStatus.PENDING
        assert data['reporter']['email'] == self.reporter.email
        assert data['reporter']['username'] == self.reporter.username
        assert data['resolved_by'] is None
        assert data['resolved_at'] is None

    def test_comment_report_has_correct_target_type(self):
        report = Report.objects.create(
            reporter=self.reporter, comment=self.comment, reason=ReportReason.HARASSMENT,
        )
        data = ReportListSerializer(report).data
        assert data['target_type'] == 'comment'
        assert data['target_id'] == self.comment.pk

    def test_null_reporter_is_handled(self):
        report = Report.objects.create(
            reporter=None, story=self.story, reason=ReportReason.OTHER,
        )
        data = ReportListSerializer(report).data
        assert data['reporter'] is None

    def test_resolved_by_is_included_after_resolution(self):
        from django.utils import timezone
        report = Report.objects.create(
            reporter=self.reporter, story=self.story, reason=ReportReason.SPAM,
            status=ReportStatus.RESOLVED, resolved_by=self.admin,
            resolved_at=timezone.now(),
        )
        data = ReportListSerializer(report).data
        assert data['resolved_by']['email'] == self.admin.email
        assert data['resolved_by']['username'] == self.admin.username

    def test_null_resolved_by_is_handled(self):
        report = Report.objects.create(
            reporter=self.reporter, story=self.story, reason=ReportReason.SPAM,
        )
        data = ReportListSerializer(report).data
        assert data['resolved_by'] is None


@pytest.mark.django_db
class TestReportResolveSerializer:
    def test_accepts_blank_resolution_note(self):
        s = ReportResolveSerializer(data={})
        assert s.is_valid()
        assert s.validated_data['resolution_note'] == ''

    def test_accepts_non_blank_resolution_note(self):
        s = ReportResolveSerializer(data={'resolution_note': 'Confirmed spam.'})
        assert s.is_valid()
        assert s.validated_data['resolution_note'] == 'Confirmed spam.'

    def test_accepts_explicit_empty_string(self):
        s = ReportResolveSerializer(data={'resolution_note': ''})
        assert s.is_valid()
        assert s.validated_data['resolution_note'] == ''
