"""Integration tests for report submission and moderation endpoints."""

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.interactions.models import Comment
from apps.reports.models import Report, ReportReason, ReportStatus
from apps.stories.models import Story
from apps.users.models import RoleChoices, User


LIST_URL = '/moderation/reports/'


def resolve_url(pk):
    return f'/moderation/reports/{pk}/resolve/'


def _make_user(email='user@example.com', username='user', role=RoleChoices.REGISTERED_USER):
    return User.objects.create_user(
        email=email,
        username=username,
        password='Password1',
        is_active=True,
        role=role,
    )


def _make_admin(email='admin@example.com', username='admin'):
    return _make_user(email, username, role=RoleChoices.ADMIN)


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
def client():
    return APIClient()


@pytest.fixture
def auth_client(client, user):
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def admin(db):
    return _make_admin()


@pytest.fixture
def regular_user(db):
    return _make_user()


@pytest.fixture
def story(db):
    author = _make_user('author@example.com', 'author')
    return _make_story(author)


@pytest.fixture
def second_story(second_user):
    """Published story owned by second_user, so auth_client (user) is not the author."""
    return _make_story(second_user, title='Another Story')


@pytest.fixture
def comment(second_user, story):
    """Comment authored by second_user so auth_client (user) is a different person."""
    return Comment.objects.create(story=story, author=second_user, text='A comment.')


# ── POST /reports/ ────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReportCreate:
    url = '/reports/'

    def _story_payload(self, story, reason=ReportReason.SPAM, description=''):
        return {
            'target_type': 'story',
            'target_id': story.pk,
            'reason': reason,
            'description': description,
        }

    def _comment_payload(self, comment, reason=ReportReason.HARASSMENT, description=''):
        return {
            'target_type': 'comment',
            'target_id': comment.pk,
            'reason': reason,
            'description': description,
        }

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
        payload = {
            'target_type': 'story',
            'target_id': second_story.pk,
            'reason': ReportReason.SPAM,
        }
        resp = auth_client.post(self.url, payload, format='json')
        assert resp.status_code == 201

    def test_all_valid_reasons_accepted(self, auth_client, second_user):
        # A distinct story per reason to avoid unique_story_report constraint.
        for i, reason in enumerate(ReportReason.values):
            story = _make_story(second_user, title=f'Story {i}')
            resp = auth_client.post(
                self.url,
                {'target_type': 'story', 'target_id': story.pk, 'reason': reason},
                format='json',
            )
            assert resp.status_code == 201, f'reason {reason!r} failed: {resp.data}'

    def test_unauthenticated_returns_401(self, client, second_story):
        resp = client.post(self.url, self._story_payload(second_story), format='json')
        assert resp.status_code == 401

    def test_missing_target_type_returns_400(self, auth_client, second_story):
        resp = auth_client.post(
            self.url,
            {'target_id': second_story.pk, 'reason': ReportReason.SPAM},
            format='json',
        )
        assert resp.status_code == 400

    def test_missing_target_id_returns_400(self, auth_client):
        resp = auth_client.post(
            self.url,
            {'target_type': 'story', 'reason': ReportReason.SPAM},
            format='json',
        )
        assert resp.status_code == 400

    def test_missing_reason_returns_400(self, auth_client, second_story):
        resp = auth_client.post(
            self.url,
            {'target_type': 'story', 'target_id': second_story.pk},
            format='json',
        )
        assert resp.status_code == 400

    def test_invalid_target_type_returns_400(self, auth_client, second_story):
        resp = auth_client.post(
            self.url,
            {'target_type': 'video', 'target_id': second_story.pk, 'reason': ReportReason.SPAM},
            format='json',
        )
        assert resp.status_code == 400

    def test_invalid_reason_returns_400(self, auth_client, second_story):
        resp = auth_client.post(
            self.url,
            {'target_type': 'story', 'target_id': second_story.pk, 'reason': 'not_a_reason'},
            format='json',
        )
        assert resp.status_code == 400

    def test_nonexistent_story_returns_404(self, auth_client):
        resp = auth_client.post(
            self.url,
            {'target_type': 'story', 'target_id': 999999, 'reason': ReportReason.SPAM},
            format='json',
        )
        assert resp.status_code == 404

    def test_nonexistent_comment_returns_404(self, auth_client):
        resp = auth_client.post(
            self.url,
            {'target_type': 'comment', 'target_id': 999999, 'reason': ReportReason.SPAM},
            format='json',
        )
        assert resp.status_code == 404

    def test_removed_story_returns_400(self, auth_client, second_user):
        removed_story = Story.objects.create(
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
        resp = auth_client.post(self.url, self._story_payload(removed_story), format='json')
        assert resp.status_code == 400

    def test_draft_story_returns_400(self, auth_client, second_user):
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
        own_story = _make_story(user, title='Mine')
        resp = auth_client.post(self.url, self._story_payload(own_story), format='json')
        assert resp.status_code == 400

    def test_reporting_own_comment_returns_400(self, auth_client, user, story):
        own_comment = Comment.objects.create(story=story, author=user, text='My comment.')
        resp = auth_client.post(self.url, self._comment_payload(own_comment), format='json')
        assert resp.status_code == 400


# ── Admin report list ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAdminReportListView:
    def test_unauthenticated_returns_401(self, client):
        response = client.get(LIST_URL)
        assert response.status_code == 401

    def test_regular_user_returns_403(self, client, regular_user):
        client.force_authenticate(user=regular_user)
        response = client.get(LIST_URL)
        assert response.status_code == 403

    def test_admin_returns_200_with_paginated_results(self, client, admin, story):
        reporter = _make_user('rep@example.com', 'rep')
        Report.objects.create(reporter=reporter, story=story, reason=ReportReason.SPAM)
        client.force_authenticate(user=admin)
        response = client.get(LIST_URL)
        assert response.status_code == 200
        assert 'results' in response.data
        assert response.data['count'] == 1

    def test_filter_by_pending_returns_only_pending(self, client, admin, story):
        reporter = _make_user('rep@example.com', 'rep')
        Report.objects.create(
            reporter=reporter,
            story=story,
            reason=ReportReason.SPAM,
            status=ReportStatus.PENDING,
        )
        story2 = _make_story(admin)
        Report.objects.create(
            reporter=reporter,
            story=story2,
            reason=ReportReason.SPAM,
            status=ReportStatus.RESOLVED,
        )
        client.force_authenticate(user=admin)
        response = client.get(LIST_URL, {'status': 'pending'})
        assert response.status_code == 200
        assert all(r['status'] == ReportStatus.PENDING for r in response.data['results'])

    def test_filter_by_resolved_returns_only_resolved(self, client, admin, story):
        reporter = _make_user('rep@example.com', 'rep')
        Report.objects.create(
            reporter=reporter,
            story=story,
            reason=ReportReason.SPAM,
            status=ReportStatus.RESOLVED,
        )
        client.force_authenticate(user=admin)
        response = client.get(LIST_URL, {'status': 'resolved'})
        assert response.status_code == 200
        assert all(r['status'] == ReportStatus.RESOLVED for r in response.data['results'])

    def test_filter_by_dismissed_returns_only_dismissed(self, client, admin, story):
        reporter = _make_user('rep@example.com', 'rep')
        Report.objects.create(
            reporter=reporter,
            story=story,
            reason=ReportReason.SPAM,
            status=ReportStatus.DISMISSED,
        )
        client.force_authenticate(user=admin)
        response = client.get(LIST_URL, {'status': 'dismissed'})
        assert response.status_code == 200
        assert all(r['status'] == ReportStatus.DISMISSED for r in response.data['results'])

    def test_invalid_status_returns_400(self, client, admin):
        client.force_authenticate(user=admin)
        response = client.get(LIST_URL, {'status': 'invalid_value'})
        assert response.status_code == 400

    def test_response_includes_reporter_and_target_fields(self, client, admin, story):
        reporter = _make_user('rep@example.com', 'rep')
        Report.objects.create(reporter=reporter, story=story, reason=ReportReason.SPAM)
        client.force_authenticate(user=admin)
        response = client.get(LIST_URL)
        report_data = response.data['results'][0]
        assert 'reporter' in report_data
        assert report_data['reporter']['email'] == reporter.email
        assert report_data['target_type'] == 'story'
        assert report_data['target_id'] == story.pk


# ── Admin report resolve ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAdminReportResolveView:
    def test_unauthenticated_returns_401(self, client, story):
        reporter = _make_user('rep@example.com', 'rep')
        report = Report.objects.create(reporter=reporter, story=story, reason=ReportReason.SPAM)
        response = client.patch(resolve_url(report.pk), {}, format='json')
        assert response.status_code == 401

    def test_regular_user_returns_403(self, client, regular_user, story):
        reporter = _make_user('rep@example.com', 'rep')
        report = Report.objects.create(reporter=reporter, story=story, reason=ReportReason.SPAM)
        client.force_authenticate(user=regular_user)
        response = client.patch(resolve_url(report.pk), {}, format='json')
        assert response.status_code == 403

    def test_admin_resolves_report_and_returns_200(self, client, admin, story):
        reporter = _make_user('rep@example.com', 'rep')
        report = Report.objects.create(reporter=reporter, story=story, reason=ReportReason.SPAM)
        client.force_authenticate(user=admin)
        response = client.patch(resolve_url(report.pk), {}, format='json')
        assert response.status_code == 200
        assert response.data['status'] == ReportStatus.RESOLVED
        assert response.data['resolved_by']['email'] == admin.email

    def test_resolution_note_is_stored(self, client, admin, story):
        reporter = _make_user('rep@example.com', 'rep')
        report = Report.objects.create(reporter=reporter, story=story, reason=ReportReason.SPAM)
        client.force_authenticate(user=admin)
        response = client.patch(
            resolve_url(report.pk),
            {'resolution_note': 'Verified spam.'},
            format='json',
        )
        assert response.status_code == 200
        assert response.data['resolution_outcome'] == 'Verified spam.'

    def test_empty_body_uses_blank_note(self, client, admin, story):
        reporter = _make_user('rep@example.com', 'rep')
        report = Report.objects.create(reporter=reporter, story=story, reason=ReportReason.SPAM)
        client.force_authenticate(user=admin)
        response = client.patch(resolve_url(report.pk), {}, format='json')
        assert response.status_code == 200
        assert response.data['resolution_outcome'] == ''

    def test_nonexistent_report_returns_404(self, client, admin):
        client.force_authenticate(user=admin)
        response = client.patch(resolve_url(99999), {}, format='json')
        assert response.status_code == 404