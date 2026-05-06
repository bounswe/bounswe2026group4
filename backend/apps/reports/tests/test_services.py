"""Unit tests for reports.services."""

from decimal import Decimal

import pytest

from django.http import Http404
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.interactions.models import Comment
from apps.reports.models import Report, ReportReason, ReportStatus
from apps.reports.services import list_reports, resolve_report, submit_report
from apps.stories.models import Story
from apps.users.models import RoleChoices, User


def _make_user(email='user@example.com', username='user', role=RoleChoices.REGISTERED_USER):
    return User.objects.create_user(
        email=email,
        username=username,
        password='Password1',
        is_active=True,
        role=role,
    )


def _make_story(user, title='T'):
    return Story.objects.create(
        user=user,
        title=title,
        narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'),
        location_lng=Decimal('0'),
        location_name='P',
        time_type=Story.TIME_EXACT,
        year=2000,
    )


@pytest.fixture
def published_story(second_user):
    return _make_story(second_user, title='Published Story')


@pytest.fixture
def comment_by_second_user(published_story, second_user):
    return Comment.objects.create(
        story=published_story,
        author=second_user,
        text='A comment.',
    )


@pytest.mark.django_db
class TestSubmitReport:

    # ── Happy path ────────────────────────────────────────────────────────────

    def test_returns_report_instance_for_story(self, user, published_story):
        report = submit_report(user, 'story', published_story.pk, ReportReason.SPAM)
        assert isinstance(report, Report)
        assert report.pk is not None

    def test_story_report_fields_saved_correctly(self, user, published_story):
        report = submit_report(user, 'story', published_story.pk, ReportReason.SPAM, 'details')
        assert report.reporter == user
        assert report.story == published_story
        assert report.comment is None
        assert report.reason == ReportReason.SPAM
        assert report.description == 'details'

    def test_returns_report_instance_for_comment(self, user, comment_by_second_user):
        report = submit_report(user, 'comment', comment_by_second_user.pk, ReportReason.HARASSMENT)
        assert isinstance(report, Report)
        assert report.pk is not None

    def test_comment_report_fields_saved_correctly(self, user, comment_by_second_user):
        report = submit_report(user, 'comment', comment_by_second_user.pk, ReportReason.HARASSMENT)
        assert report.reporter == user
        assert report.comment == comment_by_second_user
        assert report.story is None

    def test_description_defaults_to_empty_string(self, user, published_story):
        report = submit_report(user, 'story', published_story.pk, ReportReason.SPAM)
        assert report.description == ''

    def test_status_defaults_to_pending(self, user, published_story):
        report = submit_report(user, 'story', published_story.pk, ReportReason.SPAM)
        assert report.status == ReportStatus.PENDING

    # ── Not found ─────────────────────────────────────────────────────────────

    def test_nonexistent_story_raises_404(self, user):
        with pytest.raises(Http404):
            submit_report(user, 'story', 999999, ReportReason.SPAM)

    def test_nonexistent_comment_raises_404(self, user):
        with pytest.raises(Http404):
            submit_report(user, 'comment', 999999, ReportReason.SPAM)

    # ── Business rules ────────────────────────────────────────────────────────

    def test_draft_story_raises_validation_error(self, user, second_user):
        draft = Story.objects.create(
            user=second_user,
            title='Draft',
            narrative='N',
            status=Story.STATUS_DRAFT,
            location_lat=Decimal('0'),
            location_lng=Decimal('0'),
            location_name='P',
            time_type=Story.TIME_EXACT,
            year=2000,
        )
        with pytest.raises(ValidationError):
            submit_report(user, 'story', draft.pk, ReportReason.SPAM)

    def test_removed_story_raises_validation_error(self, user, second_user):
        removed = Story.objects.create(
            user=second_user,
            title='Removed',
            narrative='N',
            status=Story.STATUS_REMOVED,
            location_lat=Decimal('0'),
            location_lng=Decimal('0'),
            location_name='P',
            time_type=Story.TIME_EXACT,
            year=2000,
        )
        with pytest.raises(ValidationError):
            submit_report(user, 'story', removed.pk, ReportReason.SPAM)

    def test_reporting_own_story_raises_validation_error(self, user, story):
        with pytest.raises(ValidationError):
            submit_report(user, 'story', story.pk, ReportReason.SPAM)

    def test_reporting_own_comment_raises_validation_error(self, user, story):
        own_comment = Comment.objects.create(story=story, author=user, text='Mine.')
        with pytest.raises(ValidationError):
            submit_report(user, 'comment', own_comment.pk, ReportReason.SPAM)

    def test_duplicate_story_report_raises_validation_error(self, user, published_story):
        submit_report(user, 'story', published_story.pk, ReportReason.SPAM)
        with pytest.raises(ValidationError) as exc_info:
            submit_report(user, 'story', published_story.pk, ReportReason.SPAM)
        assert 'already reported' in str(exc_info.value.detail)

    def test_duplicate_comment_report_raises_validation_error(self, user, comment_by_second_user):
        submit_report(user, 'comment', comment_by_second_user.pk, ReportReason.HARASSMENT)
        with pytest.raises(ValidationError) as exc_info:
            submit_report(user, 'comment', comment_by_second_user.pk, ReportReason.HARASSMENT)
        assert 'already reported' in str(exc_info.value.detail)


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
        Report.objects.create(
            reporter=r2,
            story=story2,
            reason=ReportReason.SPAM,
            status=ReportStatus.RESOLVED,
        )

        assert list_reports().count() == 2

    def test_returns_only_pending_when_filtered(self):
        Report.objects.create(reporter=self.reporter, story=self.story, reason=ReportReason.SPAM)

        story2 = _make_story(self.author)
        r2 = _make_user('r2@example.com', 'r2')
        Report.objects.create(
            reporter=r2,
            story=story2,
            reason=ReportReason.SPAM,
            status=ReportStatus.RESOLVED,
        )

        qs = list_reports(status='pending')
        assert qs.count() == 1
        assert qs.first().status == ReportStatus.PENDING

    def test_returns_only_resolved_when_filtered(self):
        Report.objects.create(
            reporter=self.reporter,
            story=self.story,
            reason=ReportReason.SPAM,
            status=ReportStatus.RESOLVED,
        )

        qs = list_reports(status='resolved')
        assert all(r.status == ReportStatus.RESOLVED for r in qs)

    def test_returns_only_dismissed_when_filtered(self):
        Report.objects.create(
            reporter=self.reporter,
            story=self.story,
            reason=ReportReason.SPAM,
            status=ReportStatus.DISMISSED,
        )

        qs = list_reports(status='dismissed')
        assert qs.count() == 1
        assert qs.first().status == ReportStatus.DISMISSED

    def test_ordered_by_newest_first(self):
        r1 = Report.objects.create(
            reporter=self.reporter,
            story=self.story,
            reason=ReportReason.SPAM,
        )

        story2 = _make_story(self.author)
        r2 = _make_user('r2@example.com', 'r2')
        r2_report = Report.objects.create(
            reporter=r2,
            story=story2,
            reason=ReportReason.SPAM,
        )

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
        report = Report.objects.create(
            reporter=self.reporter,
            story=self.story,
            reason=ReportReason.SPAM,
        )

        before = timezone.now()
        result = resolve_report(report.pk, self.admin, resolution_note='Confirmed.')

        assert result.status == ReportStatus.RESOLVED
        assert result.resolved_by == self.admin
        assert result.resolved_at >= before
        assert result.resolution_outcome == 'Confirmed.'

    def test_blank_note_leaves_resolution_outcome_empty(self):
        report = Report.objects.create(
            reporter=self.reporter,
            story=self.story,
            reason=ReportReason.SPAM,
        )

        result = resolve_report(report.pk, self.admin)

        assert result.resolution_outcome == ''

    def test_persists_changes_to_db(self):
        report = Report.objects.create(
            reporter=self.reporter,
            story=self.story,
            reason=ReportReason.SPAM,
        )

        resolve_report(report.pk, self.admin, resolution_note='OK')
        refreshed = Report.objects.get(pk=report.pk)

        assert refreshed.status == ReportStatus.RESOLVED
        assert refreshed.resolved_by == self.admin

    def test_raises_404_for_nonexistent_report(self):
        with pytest.raises(Http404):
            resolve_report(99999, self.admin)