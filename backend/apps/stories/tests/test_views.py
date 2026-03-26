import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.stories.models import Story
from apps.users.models import User

FEED_URL = '/stories/feed/'


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def registered_user(db):
    return User.objects.create_user(
        email='user@example.com',
        username='testuser',
        password='Password1',
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


@pytest.mark.django_db
class TestStoryFeedView:
    def test_returns_200_for_unauthenticated_user(self, client):
        response = client.get(FEED_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_returns_200_for_authenticated_user(self, client, registered_user):
        client.force_authenticate(user=registered_user)
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
