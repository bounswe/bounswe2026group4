from decimal import Decimal

import pytest

from django.db import IntegrityError, transaction

from apps.interactions.models import Comment
from apps.reports.models import Report, ReportReason, ReportStatus
from apps.stories.models import PeriodType, Story, StoryStatus
from apps.users.models import User


def _make_story(user):
    return Story.objects.create(
        author=user, title='T', narrative_text='N',
        status=StoryStatus.PUBLISHED,
        latitude=Decimal('0'), longitude=Decimal('0'),
        place_name='P', period_type=PeriodType.EXACT, start_year=2000,
    )


@pytest.mark.django_db
class TestReport:
    def setup_method(self):
        self.reporter = User.objects.create_user(
            email='reporter@example.com', username='reporter', password='Password1',
        )
        self.author = User.objects.create_user(
            email='author@example.com', username='author', password='Password1',
        )
        self.story = _make_story(self.author)
        self.comment = Comment.objects.create(
            story=self.story, author=self.author, text='A comment.',
        )

    def test_report_on_story_can_be_created(self):
        r = Report.objects.create(reporter=self.reporter, story=self.story,
                                  reason=ReportReason.SPAM)
        assert r.pk is not None

    def test_report_on_comment_can_be_created(self):
        r = Report.objects.create(reporter=self.reporter, comment=self.comment,
                                  reason=ReportReason.HARASSMENT)
        assert r.pk is not None

    def test_status_defaults_to_pending(self):
        r = Report.objects.create(reporter=self.reporter, story=self.story,
                                  reason=ReportReason.SPAM)
        assert r.status == ReportStatus.PENDING

    def test_resolution_outcome_defaults_to_blank(self):
        r = Report.objects.create(reporter=self.reporter, story=self.story,
                                  reason=ReportReason.SPAM)
        assert r.resolution_outcome == ''

    def test_created_at_is_set_automatically(self):
        r = Report.objects.create(reporter=self.reporter, story=self.story,
                                  reason=ReportReason.SPAM)
        assert r.created_at is not None

    def test_resolved_at_defaults_to_none(self):
        r = Report.objects.create(reporter=self.reporter, story=self.story,
                                  reason=ReportReason.SPAM)
        assert r.resolved_at is None

    def test_all_report_reasons_are_accepted(self):
        for i, reason in enumerate(ReportReason.values):
            other_story = _make_story(self.author)
            r = Report.objects.create(reporter=self.reporter,
                                      story=other_story, reason=reason)
            assert r.reason == reason

    def test_reporter_set_null_when_user_is_deleted(self):
        r = Report.objects.create(reporter=self.reporter, story=self.story,
                                  reason=ReportReason.SPAM)
        r_pk = r.pk
        self.reporter.delete()
        assert Report.objects.get(pk=r_pk).reporter is None

    def test_report_deleted_when_story_is_deleted(self):
        r = Report.objects.create(reporter=self.reporter, story=self.story,
                                  reason=ReportReason.SPAM)
        r_pk = r.pk
        self.story.delete()
        assert not Report.objects.filter(pk=r_pk).exists()

    def test_report_deleted_when_comment_is_deleted(self):
        r = Report.objects.create(reporter=self.reporter, comment=self.comment,
                                  reason=ReportReason.HARASSMENT)
        r_pk = r.pk
        self.comment.delete()
        assert not Report.objects.filter(pk=r_pk).exists()

    def test_duplicate_story_report_by_same_user_raises(self):
        Report.objects.create(reporter=self.reporter, story=self.story,
                               reason=ReportReason.SPAM)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Report.objects.create(reporter=self.reporter, story=self.story,
                                      reason=ReportReason.FALSE_CONTENT)

    def test_duplicate_comment_report_by_same_user_raises(self):
        Report.objects.create(reporter=self.reporter, comment=self.comment,
                               reason=ReportReason.HARASSMENT)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Report.objects.create(reporter=self.reporter, comment=self.comment,
                                      reason=ReportReason.SPAM)

    def test_different_users_can_report_same_story(self):
        other = User.objects.create_user(
            email='r2@example.com', username='reporter2', password='Password1',
        )
        Report.objects.create(reporter=self.reporter, story=self.story,
                               reason=ReportReason.SPAM)
        Report.objects.create(reporter=other, story=self.story,
                               reason=ReportReason.SPAM)
        assert Report.objects.filter(story=self.story).count() == 2

    def test_same_user_can_report_story_and_comment_separately(self):
        # One report on the story, one on the comment — both valid, no uniqueness clash
        Report.objects.create(reporter=self.reporter, story=self.story,
                               reason=ReportReason.SPAM)
        Report.objects.create(reporter=self.reporter, comment=self.comment,
                               reason=ReportReason.HARASSMENT)
        assert Report.objects.filter(reporter=self.reporter).count() == 2

    def test_str_contains_pk_and_reason(self):
        r = Report.objects.create(reporter=self.reporter, story=self.story,
                                   reason=ReportReason.SPAM)
        assert str(r.pk) in str(r)
        assert 'spam' in str(r)
