from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.stories.models import Story

LIST_URL = '/stories/'


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


@pytest.fixture
def client():
    return APIClient()


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
