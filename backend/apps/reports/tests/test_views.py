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
        email=email, username=username, password='Password1', is_active=True, role=role,
    )


def _make_admin(email='admin@example.com', username='admin'):
    return _make_user(email, username, role=RoleChoices.ADMIN)


def _make_story(user):
    return Story.objects.create(
        user=user, title='T', narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='P', time_type=Story.TIME_EXACT, year=2000,
    )


@pytest.fixture
def client():
    return APIClient()


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
        Report.objects.create(reporter=reporter, story=story, reason=ReportReason.SPAM,
                              status=ReportStatus.PENDING)
        story2 = _make_story(admin)
        Report.objects.create(reporter=reporter, story=story2, reason=ReportReason.SPAM,
                              status=ReportStatus.RESOLVED)
        client.force_authenticate(user=admin)
        response = client.get(LIST_URL, {'status': 'pending'})
        assert response.status_code == 200
        assert all(r['status'] == ReportStatus.PENDING for r in response.data['results'])

    def test_filter_by_resolved_returns_only_resolved(self, client, admin, story):
        reporter = _make_user('rep@example.com', 'rep')
        Report.objects.create(reporter=reporter, story=story, reason=ReportReason.SPAM,
                              status=ReportStatus.RESOLVED)
        client.force_authenticate(user=admin)
        response = client.get(LIST_URL, {'status': 'resolved'})
        assert response.status_code == 200
        assert all(r['status'] == ReportStatus.RESOLVED for r in response.data['results'])

    def test_filter_by_dismissed_returns_only_dismissed(self, client, admin, story):
        reporter = _make_user('rep@example.com', 'rep')
        Report.objects.create(reporter=reporter, story=story, reason=ReportReason.SPAM,
                              status=ReportStatus.DISMISSED)
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


@pytest.mark.django_db
class TestAdminReportResolveView:
    def test_unauthenticated_returns_401(self, client, story):
        reporter = _make_user('rep@example.com', 'rep')
        report = Report.objects.create(reporter=reporter, story=story, reason=ReportReason.SPAM)
        response = client.patch(resolve_url(report.pk), {}, content_type='application/json')
        assert response.status_code == 401

    def test_regular_user_returns_403(self, client, regular_user, story):
        reporter = _make_user('rep@example.com', 'rep')
        report = Report.objects.create(reporter=reporter, story=story, reason=ReportReason.SPAM)
        client.force_authenticate(user=regular_user)
        response = client.patch(resolve_url(report.pk), {}, content_type='application/json')
        assert response.status_code == 403

    def test_admin_resolves_report_and_returns_200(self, client, admin, story):
        reporter = _make_user('rep@example.com', 'rep')
        report = Report.objects.create(reporter=reporter, story=story, reason=ReportReason.SPAM)
        client.force_authenticate(user=admin)
        response = client.patch(resolve_url(report.pk), {}, content_type='application/json')
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
            content_type='application/json',
        )
        assert response.status_code == 200
        assert response.data['resolution_outcome'] == 'Verified spam.'

    def test_empty_body_uses_blank_note(self, client, admin, story):
        reporter = _make_user('rep@example.com', 'rep')
        report = Report.objects.create(reporter=reporter, story=story, reason=ReportReason.SPAM)
        client.force_authenticate(user=admin)
        response = client.patch(resolve_url(report.pk), {}, content_type='application/json')
        assert response.status_code == 200
        assert response.data['resolution_outcome'] == ''

    def test_nonexistent_report_returns_404(self, client, admin):
        client.force_authenticate(user=admin)
        response = client.patch(resolve_url(99999), {}, content_type='application/json')
        assert response.status_code == 404
