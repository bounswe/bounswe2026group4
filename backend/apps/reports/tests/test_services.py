"""Unit tests for reports.services.submit_report."""
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from apps.interactions.models import Comment
from apps.reports.models import Report, ReportReason
from apps.reports.services import submit_report
from apps.stories.models import Story


@pytest.fixture
def published_story(second_user):
    return Story.objects.create(
        user=second_user,
        title='Published Story',
        narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'),
        location_lng=Decimal('0'),
        location_name='P',
        time_type=Story.TIME_EXACT,
        year=2000,
    )


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
        assert report.status == 'pending'

    # ── Not found ─────────────────────────────────────────────────────────────

    def test_nonexistent_story_raises_404(self, user):
        with pytest.raises(Exception) as exc_info:
            submit_report(user, 'story', 999999, ReportReason.SPAM)
        assert exc_info.type.__name__ == 'Http404'

    def test_nonexistent_comment_raises_404(self, user):
        with pytest.raises(Exception) as exc_info:
            submit_report(user, 'comment', 999999, ReportReason.SPAM)
        assert exc_info.type.__name__ == 'Http404'

    # ── Business rules ────────────────────────────────────────────────────────

    def test_draft_story_raises_validation_error(self, user, second_user):
        draft = Story.objects.create(
            user=second_user, title='Draft', narrative='N',
            status=Story.STATUS_DRAFT,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2000,
        )
        with pytest.raises(ValidationError):
            submit_report(user, 'story', draft.pk, ReportReason.SPAM)

    def test_removed_story_raises_validation_error(self, user, second_user):
        removed = Story.objects.create(
            user=second_user, title='Removed', narrative='N',
            status=Story.STATUS_REMOVED,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2000,
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
