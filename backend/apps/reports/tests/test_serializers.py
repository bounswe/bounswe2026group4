"""Unit tests for reports serializers."""

from decimal import Decimal

import pytest

from django.utils import timezone

from apps.interactions.models import Comment
from apps.reports.models import Report, ReportReason, ReportStatus
from apps.reports.serializers import (
    ReportCreateSerializer,
    ReportListSerializer,
    ReportResolveSerializer,
    ReportResponseSerializer,
)
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


def _make_story(user):
    return Story.objects.create(
        user=user,
        title='T',
        narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'),
        location_lng=Decimal('0'),
        location_name='P',
        time_type=Story.TIME_EXACT,
        year=2000,
    )


# ── ReportCreateSerializer ────────────────────────────────────────────────────

class TestReportCreateSerializer:

    def _make(self, data):
        serializer = ReportCreateSerializer(data=data)
        serializer.is_valid()
        return serializer

    def test_valid_story_payload_is_valid(self):
        serializer = self._make({
            'target_type': 'story',
            'target_id': 1,
            'reason': ReportReason.SPAM,
        })
        assert serializer.is_valid() is True

    def test_valid_comment_payload_is_valid(self):
        serializer = self._make({
            'target_type': 'comment',
            'target_id': 5,
            'reason': ReportReason.HARASSMENT,
        })
        assert serializer.is_valid() is True

    def test_description_defaults_to_empty_string(self):
        serializer = self._make({
            'target_type': 'story',
            'target_id': 1,
            'reason': ReportReason.SPAM,
        })
        assert serializer.validated_data.get('description') == ''

    def test_description_is_optional(self):
        serializer = ReportCreateSerializer(data={
            'target_type': 'story',
            'target_id': 1,
            'reason': ReportReason.SPAM,
        })
        assert serializer.is_valid() is True

    def test_description_blank_is_allowed(self):
        serializer = ReportCreateSerializer(data={
            'target_type': 'story',
            'target_id': 1,
            'reason': ReportReason.SPAM,
            'description': '',
        })
        assert serializer.is_valid() is True

    def test_invalid_target_type_fails(self):
        serializer = ReportCreateSerializer(data={
            'target_type': 'video',
            'target_id': 1,
            'reason': ReportReason.SPAM,
        })
        assert serializer.is_valid() is False
        assert 'target_type' in serializer.errors

    def test_invalid_reason_fails(self):
        serializer = ReportCreateSerializer(data={
            'target_type': 'story',
            'target_id': 1,
            'reason': 'not_valid',
        })
        assert serializer.is_valid() is False
        assert 'reason' in serializer.errors

    def test_missing_target_type_fails(self):
        serializer = ReportCreateSerializer(data={
            'target_id': 1,
            'reason': ReportReason.SPAM,
        })
        assert serializer.is_valid() is False
        assert 'target_type' in serializer.errors

    def test_missing_target_id_fails(self):
        serializer = ReportCreateSerializer(data={
            'target_type': 'story',
            'reason': ReportReason.SPAM,
        })
        assert serializer.is_valid() is False
        assert 'target_id' in serializer.errors

    def test_missing_reason_fails(self):
        serializer = ReportCreateSerializer(data={
            'target_type': 'story',
            'target_id': 1,
        })
        assert serializer.is_valid() is False
        assert 'reason' in serializer.errors

    def test_target_id_zero_fails(self):
        serializer = ReportCreateSerializer(data={
            'target_type': 'story',
            'target_id': 0,
            'reason': ReportReason.SPAM,
        })
        assert serializer.is_valid() is False
        assert 'target_id' in serializer.errors

    def test_all_valid_reasons_accepted(self):
        for reason in ReportReason.values:
            serializer = ReportCreateSerializer(data={
                'target_type': 'story',
                'target_id': 1,
                'reason': reason,
            })
            assert serializer.is_valid() is True, f'reason {reason!r} should be valid'


# ── ReportResponseSerializer ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestReportResponseSerializer:

    def _make_report(self, user, story=None, comment=None):
        return Report.objects.create(
            reporter=user,
            story=story,
            comment=comment,
            reason=ReportReason.SPAM,
        )

    def test_get_target_id_returns_story_id_for_story_report(self, user, story):
        report = self._make_report(user, story=story)
        data = ReportResponseSerializer(report).data
        assert data['target_id'] == story.pk

    def test_get_target_type_returns_story_for_story_report(self, user, story):
        report = self._make_report(user, story=story)
        data = ReportResponseSerializer(report).data
        assert data['target_type'] == 'story'

    def test_get_target_id_returns_comment_id_for_comment_report(self, user, story, second_user):
        comment = Comment.objects.create(story=story, author=second_user, text='x')
        report = self._make_report(user, comment=comment)
        data = ReportResponseSerializer(report).data
        assert data['target_id'] == comment.pk

    def test_get_target_type_returns_comment_for_comment_report(self, user, story, second_user):
        comment = Comment.objects.create(story=story, author=second_user, text='x')
        report = self._make_report(user, comment=comment)
        data = ReportResponseSerializer(report).data
        assert data['target_type'] == 'comment'

    def test_response_contains_all_expected_fields(self, user, story):
        report = self._make_report(user, story=story)
        data = ReportResponseSerializer(report).data
        assert set(data.keys()) == {
            'id',
            'target_type',
            'target_id',
            'reason',
            'status',
            'created_at',
        }

    def test_status_field_is_pending_by_default(self, user, story):
        report = self._make_report(user, story=story)
        data = ReportResponseSerializer(report).data
        assert data['status'] == ReportStatus.PENDING


# ── ReportListSerializer ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReportListSerializer:

    def setup_method(self):
        self.reporter = _make_user('reporter@example.com', 'reporter')
        self.author = _make_user('author@example.com', 'author')
        self.admin = _make_user('admin@example.com', 'admin', role=RoleChoices.ADMIN)
        self.story = _make_story(self.author)
        self.comment = Comment.objects.create(
            story=self.story,
            author=self.author,
            text='A comment.',
        )

    def test_story_report_serializes_all_fields(self):
        report = Report.objects.create(
            reporter=self.reporter,
            story=self.story,
            reason=ReportReason.SPAM,
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
            reporter=self.reporter,
            comment=self.comment,
            reason=ReportReason.HARASSMENT,
        )
        data = ReportListSerializer(report).data

        assert data['target_type'] == 'comment'
        assert data['target_id'] == self.comment.pk

    def test_null_reporter_is_handled(self):
        report = Report.objects.create(
            reporter=None,
            story=self.story,
            reason=ReportReason.OTHER,
        )
        data = ReportListSerializer(report).data

        assert data['reporter'] is None

    def test_resolved_by_is_included_after_resolution(self):
        report = Report.objects.create(
            reporter=self.reporter,
            story=self.story,
            reason=ReportReason.SPAM,
            status=ReportStatus.RESOLVED,
            resolved_by=self.admin,
            resolved_at=timezone.now(),
        )
        data = ReportListSerializer(report).data

        assert data['resolved_by']['email'] == self.admin.email
        assert data['resolved_by']['username'] == self.admin.username

    def test_null_resolved_by_is_handled(self):
        report = Report.objects.create(
            reporter=self.reporter,
            story=self.story,
            reason=ReportReason.SPAM,
        )
        data = ReportListSerializer(report).data

        assert data['resolved_by'] is None


# ── ReportResolveSerializer ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestReportResolveSerializer:

    def test_accepts_blank_resolution_note(self):
        serializer = ReportResolveSerializer(data={})
        assert serializer.is_valid()
        assert serializer.validated_data['resolution_note'] == ''

    def test_accepts_non_blank_resolution_note(self):
        serializer = ReportResolveSerializer(data={'resolution_note': 'Confirmed spam.'})
        assert serializer.is_valid()
        assert serializer.validated_data['resolution_note'] == 'Confirmed spam.'

    def test_accepts_explicit_empty_string(self):
        serializer = ReportResolveSerializer(data={'resolution_note': ''})
        assert serializer.is_valid()
        assert serializer.validated_data['resolution_note'] == ''