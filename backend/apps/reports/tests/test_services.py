from decimal import Decimal

import pytest

from django.http import Http404
from django.utils import timezone

from apps.interactions.models import Comment
from apps.reports.models import Report, ReportReason, ReportStatus
from apps.reports.services import list_reports, resolve_report
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
class TestListReports:
    def setup_method(self):
        self.reporter = _make_user('reporter@example.com', 'reporter')
        self.author = _make_user('author@example.com', 'author')
        self.story = _make_story(self.author)

    def test_returns_all_reports_when_no_status_filter(self):
        Report.objects.create(reporter=self.reporter, story=self.story, reason=ReportReason.SPAM)
        r2 = _make_user('r2@example.com', 'r2')
        story2 = _make_story(self.author)
        Report.objects.create(reporter=r2, story=story2, reason=ReportReason.SPAM,
                              status=ReportStatus.RESOLVED)
        assert list_reports().count() == 2

    def test_returns_only_pending_when_filtered(self):
        Report.objects.create(reporter=self.reporter, story=self.story, reason=ReportReason.SPAM)
        story2 = _make_story(self.author)
        r2 = _make_user('r2@example.com', 'r2')
        Report.objects.create(reporter=r2, story=story2, reason=ReportReason.SPAM,
                              status=ReportStatus.RESOLVED)
        qs = list_reports(status='pending')
        assert qs.count() == 1
        assert qs.first().status == ReportStatus.PENDING

    def test_returns_only_resolved_when_filtered(self):
        Report.objects.create(reporter=self.reporter, story=self.story, reason=ReportReason.SPAM,
                              status=ReportStatus.RESOLVED)
        qs = list_reports(status='resolved')
        assert all(r.status == ReportStatus.RESOLVED for r in qs)

    def test_returns_only_dismissed_when_filtered(self):
        Report.objects.create(reporter=self.reporter, story=self.story, reason=ReportReason.SPAM,
                              status=ReportStatus.DISMISSED)
        qs = list_reports(status='dismissed')
        assert qs.count() == 1
        assert qs.first().status == ReportStatus.DISMISSED

    def test_ordered_by_newest_first(self):
        r1 = Report.objects.create(reporter=self.reporter, story=self.story,
                                   reason=ReportReason.SPAM)
        story2 = _make_story(self.author)
        r2 = _make_user('r2@example.com', 'r2')
        r2_report = Report.objects.create(reporter=r2, story=story2, reason=ReportReason.SPAM)
        qs = list(list_reports())
        assert qs[0].pk == r2_report.pk
        assert qs[1].pk == r1.pk


@pytest.mark.django_db
class TestResolveReport:
    def setup_method(self):
        self.reporter = _make_user('reporter@example.com', 'reporter')
        self.admin = _make_user('admin@example.com', 'admin', role=RoleChoices.ADMIN)
        self.author = _make_user('author@example.com', 'author')
        self.story = _make_story(self.author)

    def test_sets_status_resolved_and_records_admin(self):
        report = Report.objects.create(reporter=self.reporter, story=self.story,
                                       reason=ReportReason.SPAM)
        before = timezone.now()
        result = resolve_report(report.pk, self.admin, resolution_note='Confirmed.')
        assert result.status == ReportStatus.RESOLVED
        assert result.resolved_by == self.admin
        assert result.resolved_at >= before
        assert result.resolution_outcome == 'Confirmed.'

    def test_blank_note_leaves_resolution_outcome_empty(self):
        report = Report.objects.create(reporter=self.reporter, story=self.story,
                                       reason=ReportReason.SPAM)
        result = resolve_report(report.pk, self.admin)
        assert result.resolution_outcome == ''

    def test_persists_changes_to_db(self):
        report = Report.objects.create(reporter=self.reporter, story=self.story,
                                       reason=ReportReason.SPAM)
        resolve_report(report.pk, self.admin, resolution_note='OK')
        refreshed = Report.objects.get(pk=report.pk)
        assert refreshed.status == ReportStatus.RESOLVED
        assert refreshed.resolved_by == self.admin

    def test_raises_404_for_nonexistent_report(self):
        with pytest.raises(Http404):
            resolve_report(99999, self.admin)
