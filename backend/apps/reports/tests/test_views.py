"""Integration tests for the report submission endpoint (issue #228)."""
from decimal import Decimal

import pytest

from rest_framework.test import APIClient

from apps.interactions.models import Comment
from apps.reports.models import Report, ReportReason, ReportStatus
from apps.stories.models import Story


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def auth_client(client, user):
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def second_story(second_user):
    """Published story owned by second_user, so auth_client (user) is not the author."""
    return Story.objects.create(
        user=second_user, title='Another Story', narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='P', time_type=Story.TIME_EXACT, year=2000,
    )


@pytest.fixture
def comment(second_user, story):
    """Comment authored by second_user so auth_client (user) is a different person."""
    return Comment.objects.create(story=story, author=second_user, text='A comment.')


# ── POST /reports/ ────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReportCreate:
    url = '/reports/'

    def _story_payload(self, story, reason=ReportReason.SPAM, description=''):
        return {'target_type': 'story', 'target_id': story.pk, 'reason': reason, 'description': description}

    def _comment_payload(self, comment, reason=ReportReason.HARASSMENT, description=''):
        return {'target_type': 'comment', 'target_id': comment.pk, 'reason': reason, 'description': description}

    # ── Happy path ────────────────────────────────────────────────────────────

    def test_report_story_returns_201(self, auth_client, second_story):
        resp = auth_client.post(self.url, self._story_payload(second_story), format='json')
        assert resp.status_code == 201

    def test_report_comment_returns_201(self, auth_client, comment):
        resp = auth_client.post(self.url, self._comment_payload(comment), format='json')
        assert resp.status_code == 201

    def test_report_story_creates_db_record(self, auth_client, user, second_story):
        auth_client.post(self.url, self._story_payload(second_story), format='json')
        assert Report.objects.filter(reporter=user, story=second_story).exists()

    def test_report_comment_creates_db_record(self, auth_client, user, comment):
        auth_client.post(self.url, self._comment_payload(comment), format='json')
        assert Report.objects.filter(reporter=user, comment=comment).exists()

    def test_report_status_is_pending(self, auth_client, second_story):
        resp = auth_client.post(self.url, self._story_payload(second_story), format='json')
        assert resp.data['status'] == ReportStatus.PENDING

    def test_response_contains_expected_fields(self, auth_client, second_story):
        resp = auth_client.post(self.url, self._story_payload(second_story), format='json')
        data = resp.data
        assert 'id' in data
        assert 'target_type' in data
        assert 'target_id' in data
        assert 'reason' in data
        assert 'status' in data
        assert 'created_at' in data

    def test_response_target_type_and_id_match_story(self, auth_client, second_story):
        resp = auth_client.post(self.url, self._story_payload(second_story), format='json')
        assert resp.data['target_type'] == 'story'
        assert resp.data['target_id'] == second_story.pk

    def test_response_target_type_and_id_match_comment(self, auth_client, comment):
        resp = auth_client.post(self.url, self._comment_payload(comment), format='json')
        assert resp.data['target_type'] == 'comment'
        assert resp.data['target_id'] == comment.pk

    def test_description_is_optional(self, auth_client, second_story):
        payload = {'target_type': 'story', 'target_id': second_story.pk, 'reason': ReportReason.SPAM}
        resp = auth_client.post(self.url, payload, format='json')
        assert resp.status_code == 201

    def test_all_valid_reasons_accepted(self, auth_client, second_user):
        # A distinct story per reason to avoid unique_story_report constraint
        for i, reason in enumerate(ReportReason.values):
            s = Story.objects.create(
                user=second_user, title=f'Story {i}', narrative='N',
                status=Story.STATUS_PUBLISHED,
                location_lat=Decimal('0'), location_lng=Decimal('0'),
                location_name='P', time_type=Story.TIME_EXACT, year=2000,
            )
            resp = auth_client.post(self.url, {'target_type': 'story', 'target_id': s.pk, 'reason': reason}, format='json')
            assert resp.status_code == 201, f'reason {reason!r} failed: {resp.data}'

    # ── Authentication ────────────────────────────────────────────────────────

    def test_unauthenticated_returns_401(self, client, second_story):
        resp = client.post(self.url, self._story_payload(second_story), format='json')
        assert resp.status_code == 401

    # ── Validation errors ─────────────────────────────────────────────────────

    def test_missing_target_type_returns_400(self, auth_client, second_story):
        resp = auth_client.post(self.url, {'target_id': second_story.pk, 'reason': ReportReason.SPAM}, format='json')
        assert resp.status_code == 400

    def test_missing_target_id_returns_400(self, auth_client):
        resp = auth_client.post(self.url, {'target_type': 'story', 'reason': ReportReason.SPAM}, format='json')
        assert resp.status_code == 400

    def test_missing_reason_returns_400(self, auth_client, second_story):
        resp = auth_client.post(self.url, {'target_type': 'story', 'target_id': second_story.pk}, format='json')
        assert resp.status_code == 400

    def test_invalid_target_type_returns_400(self, auth_client, second_story):
        resp = auth_client.post(self.url, {'target_type': 'video', 'target_id': second_story.pk, 'reason': ReportReason.SPAM}, format='json')
        assert resp.status_code == 400

    def test_invalid_reason_returns_400(self, auth_client, second_story):
        resp = auth_client.post(self.url, {'target_type': 'story', 'target_id': second_story.pk, 'reason': 'not_a_reason'}, format='json')
        assert resp.status_code == 400

    # ── Not found ─────────────────────────────────────────────────────────────

    def test_nonexistent_story_returns_404(self, auth_client):
        resp = auth_client.post(self.url, {'target_type': 'story', 'target_id': 999999, 'reason': ReportReason.SPAM}, format='json')
        assert resp.status_code == 404

    def test_nonexistent_comment_returns_404(self, auth_client):
        resp = auth_client.post(self.url, {'target_type': 'comment', 'target_id': 999999, 'reason': ReportReason.SPAM}, format='json')
        assert resp.status_code == 404

    # ── Business rules ────────────────────────────────────────────────────────

    def test_removed_story_returns_400(self, auth_client, second_user):
        removed_story = Story.objects.create(
            user=second_user, title='Removed', narrative='N',
            status=Story.STATUS_REMOVED,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2000,
        )
        resp = auth_client.post(self.url, self._story_payload(removed_story), format='json')
        assert resp.status_code == 400

    def test_draft_story_returns_400(self, auth_client, second_user):
        draft = Story.objects.create(
            user=second_user, title='Draft', narrative='N',
            status=Story.STATUS_DRAFT,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2000,
        )
        resp = auth_client.post(self.url, self._story_payload(draft), format='json')
        assert resp.status_code == 400

    def test_duplicate_story_report_returns_400(self, auth_client, second_story):
        auth_client.post(self.url, self._story_payload(second_story), format='json')
        resp = auth_client.post(self.url, self._story_payload(second_story), format='json')
        assert resp.status_code == 400

    def test_duplicate_comment_report_returns_400(self, auth_client, comment):
        auth_client.post(self.url, self._comment_payload(comment), format='json')
        resp = auth_client.post(self.url, self._comment_payload(comment), format='json')
        assert resp.status_code == 400

    def test_reporting_own_story_returns_400(self, auth_client, user):
        own_story = Story.objects.create(
            user=user, title='Mine', narrative='N',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2000,
        )
        resp = auth_client.post(self.url, self._story_payload(own_story), format='json')
        assert resp.status_code == 400

    def test_reporting_own_comment_returns_400(self, auth_client, user, story):
        own_comment = Comment.objects.create(story=story, author=user, text='My comment.')
        resp = auth_client.post(self.url, self._comment_payload(own_comment), format='json')
        assert resp.status_code == 400
