from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.stories.models import Story
from apps.users.models import RoleChoices, User

FEED_URL = '/stories/feed/'
LIST_URL = '/stories/'


# ── Fixtures & helpers ────────────────────────────────────────────────────────

@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email='admin@example.com',
        username='adminuser',
        password='Password1',
        role=RoleChoices.ADMIN,
    )


def make_story(**kwargs):
    defaults = dict(
        title='Test Story',
        narrative='A narrative about the place.',
        location_lat='41.0',
        location_lng='28.9',
        location_name='Istanbul',
        time_type=Story.TIME_EXACT,
        year=1950,
        status=Story.STATUS_PUBLISHED,
    )
    defaults.update(kwargs)
    return Story.objects.create(**defaults)


def make_story_payload(**overrides):
    payload = {
        'title': 'The City Walls',
        'narrative': 'A story about the walls of the city.',
        'location_lat': '41.008200',
        'location_lng': '28.978400',
        'location_name': 'Old City',
        'region': 'Fatih',
        'time_type': Story.TIME_EXACT,
        'year': 1453,
        'contributor_visible': True,
        'status': Story.STATUS_PUBLISHED,
    }
    payload.update(overrides)
    return payload


# ── GET /stories/feed/ ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStoryFeedView:
    def test_returns_200_for_unauthenticated_user(self, client):
        response = client.get(FEED_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_returns_200_for_authenticated_user(self, client, user):
        client.force_authenticate(user=user)
        response = client.get(FEED_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_returns_paginated_response_shape(self, client):
        response = client.get(FEED_URL)
        assert 'count' in response.data
        assert 'next' in response.data
        assert 'previous' in response.data
        assert 'results' in response.data

    def test_returns_paginated_results(self, client):
        # Create 15 stories — more than the default page_size of 10
        for i in range(15):
            make_story(title=f'Story {i}')
        response = client.get(FEED_URL)
        assert response.data['count'] == 15
        assert len(response.data['results']) == 10
        assert response.data['next'] is not None

    def test_second_page_returns_remaining_results(self, client):
        for i in range(15):
            make_story(title=f'Story {i}')
        response = client.get(FEED_URL + '?page=2')
        assert len(response.data['results']) == 5
        assert response.data['previous'] is not None

    def test_sorts_by_recent_by_default(self, client):
        s1 = make_story(title='Oldest')
        s2 = make_story(title='Middle')
        s3 = make_story(title='Newest')
        response = client.get(FEED_URL)
        ids = [r['id'] for r in response.data['results']]
        assert ids == [s3.id, s2.id, s1.id]

    def test_excludes_removed_stories(self, client):
        make_story(title='Published')
        make_story(title='Removed', status=Story.STATUS_REMOVED)
        response = client.get(FEED_URL)
        assert response.data['count'] == 1
        assert response.data['results'][0]['title'] == 'Published'

    def test_excludes_draft_stories(self, client):
        make_story(title='Draft', status=Story.STATUS_DRAFT)
        response = client.get(FEED_URL)
        assert response.data['count'] == 0

    def test_filters_by_year_from(self, client):
        make_story(title='Old', year=1900)
        make_story(title='New', year=2000)
        response = client.get(FEED_URL + '?year_from=1950')
        assert response.data['count'] == 1
        assert response.data['results'][0]['title'] == 'New'

    def test_filters_by_year_to(self, client):
        make_story(title='Old', year=1900)
        make_story(title='New', year=2000)
        response = client.get(FEED_URL + '?year_to=1950')
        assert response.data['count'] == 1
        assert response.data['results'][0]['title'] == 'Old'

    def test_filters_by_year_from_and_year_to(self, client):
        make_story(title='Too Early', year=1800)
        make_story(title='In Range', year=1950)
        make_story(title='Too Late', year=2100)
        response = client.get(FEED_URL + '?year_from=1900&year_to=2000')
        assert response.data['count'] == 1
        assert response.data['results'][0]['title'] == 'In Range'

    def test_filters_by_location(self, client):
        make_story(title='Istanbul Story', location_name='Istanbul')
        make_story(title='Ankara Story', location_name='Ankara')
        response = client.get(FEED_URL + '?location=Istanbul')
        assert response.data['count'] == 1
        assert response.data['results'][0]['title'] == 'Istanbul Story'

    def test_location_filter_is_case_insensitive(self, client):
        make_story(location_name='Galata Bridge')
        response = client.get(FEED_URL + '?location=galata')
        assert response.data['count'] == 1

    def test_returns_empty_list_when_no_stories_match(self, client):
        make_story(location_name='Istanbul')
        response = client.get(FEED_URL + '?location=Ankara')
        assert response.data['count'] == 0
        assert response.data['results'] == []

    def test_returns_empty_list_when_no_stories_exist(self, client):
        response = client.get(FEED_URL)
        assert response.data['count'] == 0
        assert response.data['results'] == []

    def test_result_contains_expected_card_fields(self, client):
        make_story()
        response = client.get(FEED_URL)
        card = response.data['results'][0]
        expected_fields = {
            'id', 'title', 'location_name', 'location_lat', 'location_lng',
            'time_type', 'year', 'year_start', 'year_end',
            'status', 'contributor_name', 'preview_text', 'submitted_at',
        }
        assert expected_fields == set(card.keys())

    def test_returns_400_for_invalid_sort_by(self, client):
        response = client.get(FEED_URL + '?sort_by=invalid')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_400_for_non_integer_year_from(self, client):
        response = client.get(FEED_URL + '?year_from=abc')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_400_when_year_from_greater_than_year_to(self, client):
        response = client.get(FEED_URL + '?year_from=2000&year_to=1900')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── GET /stories/ ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStoryListView:
    def test_guest_can_list_stories(self, client, story):
        response = client.get(LIST_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['id'] == story.id

    def test_list_returns_paginated_response_shape(self, client):
        response = client.get(LIST_URL)
        assert 'count' in response.data
        assert 'next' in response.data
        assert 'previous' in response.data
        assert 'results' in response.data

    def test_list_excludes_draft_stories(self, client, user):
        Story.objects.create(
            user=user, title='Draft', narrative='x',
            location_lat='41.0', location_lng='28.9', location_name='Place',
            time_type=Story.TIME_EXACT, year=2000, status=Story.STATUS_DRAFT,
        )
        response = client.get(LIST_URL)
        assert response.data['count'] == 0

    def test_list_excludes_removed_stories(self, client, user):
        Story.objects.create(
            user=user, title='Removed', narrative='x',
            location_lat='41.0', location_lng='28.9', location_name='Place',
            time_type=Story.TIME_EXACT, year=2000, status=Story.STATUS_REMOVED,
        )
        response = client.get(LIST_URL)
        assert response.data['count'] == 0


# ── POST /stories/ ────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStoryCreateView:
    def test_authenticated_user_can_create_story(self, client, user):
        client.force_authenticate(user=user)
        response = client.post(LIST_URL, make_story_payload(), format='json')
        assert response.status_code == status.HTTP_201_CREATED
        created = Story.objects.get(pk=response.data['id'])
        assert created.user == user
        assert created.title == 'The City Walls'

    def test_guest_cannot_create_story(self, client):
        response = client.post(LIST_URL, make_story_payload(), format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_assigns_authenticated_user(self, client, user):
        client.force_authenticate(user=user)
        response = client.post(LIST_URL, make_story_payload(title='Ownership Test'), format='json')
        assert response.status_code == status.HTTP_201_CREATED
        created = Story.objects.get(pk=response.data['id'])
        assert created.user == user
        assert created.location_lat == Decimal('41.008200')

    def test_create_returns_400_for_removed_status(self, client, user):
        client.force_authenticate(user=user)
        response = client.post(LIST_URL, make_story_payload(status=Story.STATUS_REMOVED), format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_returns_400_when_year_missing_for_exact_time_type(self, client, user):
        client.force_authenticate(user=user)
        response = client.post(LIST_URL, make_story_payload(year=None), format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── GET /stories/<pk>/ & PATCH /stories/<pk>/ ────────────────────────────────

@pytest.mark.django_db
class TestStoryDetailView:
    def test_guest_can_retrieve_story(self, client, story):
        url = reverse('stories:story-detail', kwargs={'pk': story.pk})
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == story.id
        assert response.data['title'] == story.title

    def test_owner_can_partially_update_story(self, client, user, story):
        client.force_authenticate(user=user)
        url = reverse('stories:story-detail', kwargs={'pk': story.pk})
        response = client.patch(url, {'title': 'Updated Title', 'region': 'Beyoglu'}, format='json')
        assert response.status_code == status.HTTP_200_OK
        story.refresh_from_db()
        assert story.title == 'Updated Title'
        assert story.region == 'Beyoglu'

    def test_non_owner_cannot_update_story(self, client, second_user, story):
        client.force_authenticate(user=second_user)
        url = reverse('stories:story-detail', kwargs={'pk': story.pk})
        response = client.patch(url, {'title': 'Not Allowed'}, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN
        story.refresh_from_db()
        assert story.title != 'Not Allowed'

    def test_admin_can_update_any_story(self, client, admin_user, story):
        client.force_authenticate(user=admin_user)
        url = reverse('stories:story-detail', kwargs={'pk': story.pk})
        response = client.patch(url, {'title': 'Admin Updated'}, format='json')
        assert response.status_code == status.HTTP_200_OK
        story.refresh_from_db()
        assert story.title == 'Admin Updated'

    def test_guest_cannot_update_story(self, client, story):
        url = reverse('stories:story-detail', kwargs={'pk': story.pk})
        response = client.patch(url, {'title': 'Guest Update'}, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
