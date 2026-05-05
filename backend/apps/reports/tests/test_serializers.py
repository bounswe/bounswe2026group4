"""Unit tests for reports serializers."""
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from apps.reports.models import Report, ReportReason, ReportStatus
from apps.reports.serializers import ReportCreateSerializer, ReportResponseSerializer


# ── ReportCreateSerializer ────────────────────────────────────────────────────

class TestReportCreateSerializer:

    def _make(self, data):
        s = ReportCreateSerializer(data=data)
        s.is_valid()
        return s

    def test_valid_story_payload_is_valid(self):
        s = self._make({'target_type': 'story', 'target_id': 1, 'reason': ReportReason.SPAM})
        assert s.is_valid() is True

    def test_valid_comment_payload_is_valid(self):
        s = self._make({'target_type': 'comment', 'target_id': 5, 'reason': ReportReason.HARASSMENT})
        assert s.is_valid() is True

    def test_description_defaults_to_empty_string(self):
        s = self._make({'target_type': 'story', 'target_id': 1, 'reason': ReportReason.SPAM})
        assert s.validated_data.get('description') == ''

    def test_description_is_optional(self):
        s = ReportCreateSerializer(data={'target_type': 'story', 'target_id': 1, 'reason': ReportReason.SPAM})
        assert s.is_valid() is True

    def test_description_blank_is_allowed(self):
        s = ReportCreateSerializer(data={
            'target_type': 'story', 'target_id': 1,
            'reason': ReportReason.SPAM, 'description': '',
        })
        assert s.is_valid() is True

    def test_invalid_target_type_fails(self):
        s = ReportCreateSerializer(data={'target_type': 'video', 'target_id': 1, 'reason': ReportReason.SPAM})
        assert s.is_valid() is False
        assert 'target_type' in s.errors

    def test_invalid_reason_fails(self):
        s = ReportCreateSerializer(data={'target_type': 'story', 'target_id': 1, 'reason': 'not_valid'})
        assert s.is_valid() is False
        assert 'reason' in s.errors

    def test_missing_target_type_fails(self):
        s = ReportCreateSerializer(data={'target_id': 1, 'reason': ReportReason.SPAM})
        assert s.is_valid() is False
        assert 'target_type' in s.errors

    def test_missing_target_id_fails(self):
        s = ReportCreateSerializer(data={'target_type': 'story', 'reason': ReportReason.SPAM})
        assert s.is_valid() is False
        assert 'target_id' in s.errors

    def test_missing_reason_fails(self):
        s = ReportCreateSerializer(data={'target_type': 'story', 'target_id': 1})
        assert s.is_valid() is False
        assert 'reason' in s.errors

    def test_target_id_zero_fails(self):
        s = ReportCreateSerializer(data={'target_type': 'story', 'target_id': 0, 'reason': ReportReason.SPAM})
        assert s.is_valid() is False
        assert 'target_id' in s.errors

    def test_all_valid_reasons_accepted(self):
        for reason in ReportReason.values:
            s = ReportCreateSerializer(data={'target_type': 'story', 'target_id': 1, 'reason': reason})
            assert s.is_valid() is True, f'reason {reason!r} should be valid'


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
        from apps.interactions.models import Comment
        comment = Comment.objects.create(story=story, author=second_user, text='x')
        report = self._make_report(user, comment=comment)
        data = ReportResponseSerializer(report).data
        assert data['target_id'] == comment.pk

    def test_get_target_type_returns_comment_for_comment_report(self, user, story, second_user):
        from apps.interactions.models import Comment
        comment = Comment.objects.create(story=story, author=second_user, text='x')
        report = self._make_report(user, comment=comment)
        data = ReportResponseSerializer(report).data
        assert data['target_type'] == 'comment'

    def test_response_contains_all_expected_fields(self, user, story):
        report = self._make_report(user, story=story)
        data = ReportResponseSerializer(report).data
        assert set(data.keys()) == {'id', 'target_type', 'target_id', 'reason', 'status', 'created_at'}

    def test_status_field_is_pending_by_default(self, user, story):
        report = self._make_report(user, story=story)
        data = ReportResponseSerializer(report).data
        assert data['status'] == ReportStatus.PENDING
