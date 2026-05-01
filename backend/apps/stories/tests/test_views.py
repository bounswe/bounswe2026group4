from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.interactions.models import Like, SavedStory
from apps.media.models import MediaItem, MediaType
from apps.stories.models import Story
from apps.tags.models import StoryTag, Tag
from apps.users.models import RoleChoices, User

FEED_URL = '/stories/feed/'
LIST_URL = '/stories/'
MAP_URL = '/stories/map/'
SEARCH_URL = '/stories/search/'


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
            'time_type', 'year', 'year_start', 'year_end', 'date_value', 'time_value',
            'status', 'contributor_name', 'preview_text',
            'like_count', 'save_count',
            'user_has_liked', 'user_has_saved', 'submitted_at',
        }
        assert expected_fields == set(card.keys())

    def test_feed_result_contains_interaction_counts(self, client):
        make_story(like_count=6, save_count=2)
        response = client.get(FEED_URL)
        card = response.data['results'][0]
        assert card['like_count'] == 6
        assert card['save_count'] == 2

    def test_returns_400_for_invalid_sort_by(self, client):
        response = client.get(FEED_URL + '?sort_by=invalid')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_400_for_non_integer_year_from(self, client):
        response = client.get(FEED_URL + '?year_from=abc')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_400_when_year_from_greater_than_year_to(self, client):
        response = client.get(FEED_URL + '?year_from=2000&year_to=1900')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_feed_tag_filter_returns_only_tagged_stories(self, client):
        tagged = make_story(title='Tagged')
        make_story(title='Untagged')
        tag = Tag.objects.create(name='folklore')
        StoryTag.objects.create(story=tagged, tag=tag)
        response = client.get(FEED_URL + '?tag=folklore')
        assert response.data['count'] == 1
        assert response.data['results'][0]['title'] == 'Tagged'

    def test_feed_tag_filter_returns_empty_when_no_match(self, client):
        make_story(title='Untagged')
        Tag.objects.create(name='folklore')
        response = client.get(FEED_URL + '?tag=folklore')
        assert response.data['count'] == 0

    def test_feed_tag_and_location_filter_combined(self, client):
        match = make_story(title='Match', location_name='Istanbul')
        no_match = make_story(title='Wrong Location', location_name='Ankara')
        tag = Tag.objects.create(name='folklore')
        StoryTag.objects.create(story=match, tag=tag)
        StoryTag.objects.create(story=no_match, tag=tag)
        response = client.get(FEED_URL + '?tag=folklore&location=Istanbul')
        assert response.data['count'] == 1
        assert response.data['results'][0]['title'] == 'Match'


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


# ── GET /stories/search/ ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStorySearchView:
    def test_search_endpoint_returns_200_for_unauthenticated_user(self, client):
        response = client.get(SEARCH_URL + '?q=Istanbul')
        assert response.status_code == status.HTTP_200_OK

    def test_search_endpoint_returns_results_matching_title(self, client):
        make_story(title='Istanbul Chronicles', location_name='Kadikoy')
        make_story(title='Ankara Stories', location_name='Kizilay')
        response = client.get(SEARCH_URL + '?q=Istanbul')
        assert response.data['count'] == 1
        assert response.data['results'][0]['title'] == 'Istanbul Chronicles'

    def test_search_endpoint_returns_results_matching_location_name(self, client):
        make_story(title='A Story', location_name='Galata Bridge')
        make_story(title='Another Story', location_name='Bosphorus')
        response = client.get(SEARCH_URL + '?q=Galata')
        assert response.data['count'] == 1
        assert response.data['results'][0]['title'] == 'A Story'

    def test_search_endpoint_returns_400_when_q_is_missing(self, client):
        response = client.get(SEARCH_URL)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_search_endpoint_returns_400_when_q_is_blank(self, client):
        response = client.get(SEARCH_URL + '?q=')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_search_endpoint_returns_empty_list_when_no_match(self, client):
        make_story(title='Istanbul Tales')
        response = client.get(SEARCH_URL + '?q=Bosphorus')
        assert response.data['count'] == 0
        assert response.data['results'] == []

    def test_search_endpoint_excludes_removed_stories(self, client):
        make_story(title='Gone Story', status=Story.STATUS_REMOVED)
        response = client.get(SEARCH_URL + '?q=Gone')
        assert response.data['count'] == 0

    def test_search_filters_by_year_from(self, client):
        make_story(title='Old Istanbul', year=1800)
        make_story(title='New Istanbul', year=1950)
        response = client.get(SEARCH_URL + '?q=Istanbul&year_from=1900')
        assert response.data['count'] == 1
        assert response.data['results'][0]['title'] == 'New Istanbul'

    def test_search_filters_by_year_to(self, client):
        make_story(title='Old Istanbul', year=1800)
        make_story(title='New Istanbul', year=1950)
        response = client.get(SEARCH_URL + '?q=Istanbul&year_to=1900')
        assert response.data['count'] == 1
        assert response.data['results'][0]['title'] == 'Old Istanbul'

    def test_search_filters_by_location(self, client):
        make_story(title='Galata Story', location_name='Galata Bridge')
        make_story(title='Ankara Story', location_name='Ankara Castle')
        response = client.get(SEARCH_URL + '?q=Story&location=Galata')
        assert response.data['count'] == 1
        assert response.data['results'][0]['title'] == 'Galata Story'

    def test_search_with_combined_filters(self, client):
        make_story(title='Tower Galata', year=1900, location_name='Galata')
        make_story(title='Tower Ankara', year=1900, location_name='Ankara')
        make_story(title='Tower Late', year=2000, location_name='Galata')
        response = client.get(SEARCH_URL + '?q=Tower&year_from=1800&year_to=1950&location=Galata')
        assert response.data['count'] == 1
        assert response.data['results'][0]['title'] == 'Tower Galata'

    def test_search_returns_400_for_invalid_year_range(self, client):
        response = client.get(SEARCH_URL + '?q=Istanbul&year_from=2000&year_to=1900')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_search_returns_400_for_invalid_sort_by(self, client):
        response = client.get(SEARCH_URL + '?q=Istanbul&sort_by=invalid')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_search_tag_filter_narrows_results(self, client):
        tagged = make_story(title='Istanbul Tale')
        make_story(title='Istanbul Lore')
        tag = Tag.objects.create(name='folklore')
        StoryTag.objects.create(story=tagged, tag=tag)
        response = client.get(SEARCH_URL + '?q=Istanbul&tag=folklore')
        assert response.data['count'] == 1
        assert response.data['results'][0]['title'] == 'Istanbul Tale'

    def test_search_tag_filter_returns_empty_when_tag_missing(self, client):
        make_story(title='Istanbul Tale')
        response = client.get(SEARCH_URL + '?q=Istanbul&tag=folklore')
        assert response.data['count'] == 0

    def test_search_tag_and_q_both_must_match(self, client):
        # Story has the tag but q does not match its title or location_name
        story = make_story(title='Ankara Chronicle', location_name='Ankara')
        tag = Tag.objects.create(name='folklore')
        StoryTag.objects.create(story=story, tag=tag)
        response = client.get(SEARCH_URL + '?q=Istanbul&tag=folklore')
        assert response.data['count'] == 0


# ── GET /stories/map/ ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStoryMapView:
    def test_returns_200_without_authentication(self, client):
        response = client.get(MAP_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_response_is_feature_collection(self, client):
        response = client.get(MAP_URL)
        assert response.data['type'] == 'FeatureCollection'
        assert 'features' in response.data
        assert isinstance(response.data['features'], list)

    def test_response_is_not_paginated(self, client):
        response = client.get(MAP_URL)
        assert 'count' not in response.data
        assert 'next' not in response.data
        assert 'previous' not in response.data
        assert 'results' not in response.data

    def test_each_story_is_a_geojson_feature(self, client):
        make_story(status=Story.STATUS_PUBLISHED)
        response = client.get(MAP_URL)
        feature = response.data['features'][0]
        assert feature['type'] == 'Feature'
        assert 'id' in feature
        assert feature['geometry']['type'] == 'Point'
        assert 'properties' in feature

    def test_coordinates_are_lng_lat_order(self, client):
        # RFC 7946 §3.1.1: coordinates are [longitude, latitude]
        make_story(location_lat='41.015137', location_lng='28.979530')
        response = client.get(MAP_URL)
        coords = response.data['features'][0]['geometry']['coordinates']
        assert coords[0] == pytest.approx(28.979530)
        assert coords[1] == pytest.approx(41.015137)

    def test_only_published_stories_appear(self, client):
        make_story(title='Published', status=Story.STATUS_PUBLISHED)
        make_story(title='Draft', status=Story.STATUS_DRAFT)
        make_story(title='Removed', status=Story.STATUS_REMOVED)
        response = client.get(MAP_URL)
        assert len(response.data['features']) == 1
        assert response.data['features'][0]['properties']['title'] == 'Published'

    def test_empty_feature_collection_when_no_published_stories(self, client):
        make_story(status=Story.STATUS_DRAFT)
        response = client.get(MAP_URL)
        assert response.data['features'] == []

    def test_returns_all_stories_without_pagination(self, client):
        for i in range(15):
            make_story(title=f'Story {i}')
        response = client.get(MAP_URL)
        assert len(response.data['features']) == 15

    def test_year_from_filter_excludes_older_stories(self, client):
        make_story(title='Old', time_type=Story.TIME_EXACT, year=1800)
        make_story(title='New', time_type=Story.TIME_EXACT, year=2000)
        response = client.get(MAP_URL + '?year_from=1900')
        assert len(response.data['features']) == 1
        assert response.data['features'][0]['properties']['title'] == 'New'

    def test_year_to_filter_excludes_newer_stories(self, client):
        make_story(title='Old', time_type=Story.TIME_EXACT, year=1800)
        make_story(title='New', time_type=Story.TIME_EXACT, year=2000)
        response = client.get(MAP_URL + '?year_to=1900')
        assert len(response.data['features']) == 1
        assert response.data['features'][0]['properties']['title'] == 'Old'

    def test_location_filter_is_case_insensitive(self, client):
        make_story(title='Istanbul Story', location_name='Galata Bridge')
        make_story(title='Ankara Story', location_name='Atakule Tower')
        response = client.get(MAP_URL + '?location=galata')
        assert len(response.data['features']) == 1
        assert response.data['features'][0]['properties']['location_name'] == 'Galata Bridge'

    def test_invalid_year_range_returns_400(self, client):
        response = client.get(MAP_URL + '?year_from=2000&year_to=1900')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_narrative_not_exposed_in_properties(self, client):
        make_story(narrative='Secret text that should not appear.')
        response = client.get(MAP_URL)
        if response.data['features']:
            assert 'narrative' not in response.data['features'][0]['properties']

    def test_map_tag_filter_returns_only_tagged_stories(self, client):
        tagged = make_story(title='Tagged')
        make_story(title='Untagged')
        tag = Tag.objects.create(name='ottoman-era')
        StoryTag.objects.create(story=tagged, tag=tag)
        response = client.get(MAP_URL + '?tag=ottoman-era')
        assert len(response.data['features']) == 1
        assert response.data['features'][0]['properties']['title'] == 'Tagged'

    def test_map_tag_filter_returns_empty_when_no_match(self, client):
        make_story(title='Untagged')
        response = client.get(MAP_URL + '?tag=ottoman-era')
        assert len(response.data['features']) == 0


# ── StoryDetailView — media_items ─────────────────────────────────────────────

def make_media_item(story, order=0):
    """Create a MediaItem attached to *story* without writing anything to disk.

    FileField stores only a path string in the DB; .url works as long as the
    name is non-empty — no actual file is needed for integration tests.
    """
    return MediaItem.objects.create(
        story=story,
        media_type=MediaType.IMAGE,
        file_size=1024,
        original_filename='photo.jpg',
        order=order,
        file='stories/2024/01/photo.jpg',
    )


@pytest.mark.django_db
class TestStoryDetailMediaItems:
    def _detail_url(self, pk):
        return f'/stories/{pk}/'

    def test_get_story_detail_includes_media_items_field(self, client):
        story = make_story()
        response = client.get(self._detail_url(story.pk))
        assert response.status_code == status.HTTP_200_OK
        assert 'media_items' in response.data

    def test_get_story_detail_media_items_empty_when_no_media(self, client):
        story = make_story()
        response = client.get(self._detail_url(story.pk))
        assert response.data['media_items'] == []

    def test_get_story_detail_media_items_contains_uploaded_images(self, client):
        story = make_story()
        item = make_media_item(story)
        response = client.get(self._detail_url(story.pk))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['media_items']) == 1
        result = response.data['media_items'][0]
        assert result['id'] == item.id
        assert result['media_type'] == MediaType.IMAGE
        assert result['order'] == 0
        assert result['url'].startswith('http')


# ── user_has_liked / user_has_saved — view integration ───────────────────────

def make_user_for_interaction(email='liker@example.com', username='liker'):
    return User.objects.create_user(email=email, username=username, password='Password1')


@pytest.mark.django_db
class TestStoryDetailUserInteraction:
    def _detail_url(self, pk):
        return f'/stories/{pk}/'

    def test_user_has_liked_false_for_unauthenticated(self, client):
        story = make_story()
        response = client.get(self._detail_url(story.pk))
        assert response.status_code == status.HTTP_200_OK
        assert response.data['user_has_liked'] is False
        assert response.data['user_has_saved'] is False

    def test_user_has_liked_true_after_like(self):
        user = make_user_for_interaction()
        story = make_story()
        Like.objects.create(user=user, story=story)
        auth_client = APIClient()
        auth_client.force_authenticate(user=user)
        response = auth_client.get(self._detail_url(story.pk))
        assert response.status_code == status.HTTP_200_OK
        assert response.data['user_has_liked'] is True
        assert response.data['user_has_saved'] is False


@pytest.mark.django_db
class TestStoryFeedUserInteraction:
    def test_feed_user_has_liked_false_for_unauthenticated(self, client):
        make_story()
        response = client.get(FEED_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['results'][0]['user_has_liked'] is False
        assert response.data['results'][0]['user_has_saved'] is False

    def test_feed_user_has_liked_true_after_like(self):
        user = make_user_for_interaction()
        story = make_story()
        Like.objects.create(user=user, story=story)
        auth_client = APIClient()
        auth_client.force_authenticate(user=user)
        response = auth_client.get(FEED_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['results'][0]['user_has_liked'] is True
        assert response.data['results'][0]['user_has_saved'] is False


# ── DELETE /stories/<pk>/ ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStoryDelete:
    def _detail_url(self, pk):
        return f'/stories/{pk}/'

    def test_owner_can_delete_own_story(self, client, user, story):
        client.force_authenticate(user=user)
        response = client.delete(self._detail_url(story.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Story.objects.filter(pk=story.pk).exists()

    def test_admin_can_delete_any_story(self, client, admin_user, story):
        client.force_authenticate(user=admin_user)
        response = client.delete(self._detail_url(story.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Story.objects.filter(pk=story.pk).exists()

    def test_other_user_cannot_delete_story(self, client, second_user, story):
        client.force_authenticate(user=second_user)
        response = client.delete(self._detail_url(story.pk))
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert Story.objects.filter(pk=story.pk).exists()

    def test_unauthenticated_cannot_delete_story(self, client, story):
        response = client.delete(self._detail_url(story.pk))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert Story.objects.filter(pk=story.pk).exists()

    def test_delete_nonexistent_story_returns_404(self, client, user):
        client.force_authenticate(user=user)
        response = client.delete(self._detail_url(99999))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_returns_no_body(self, client, user, story):
        client.force_authenticate(user=user)
        response = client.delete(self._detail_url(story.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not response.data


# ── Story tag assignment — views integration ──────────────────────────────────

@pytest.mark.django_db
class TestStoryTagAssignment:
    def _detail_url(self, pk):
        return f'/stories/{pk}/'

    def test_create_story_with_tag_ids_returns_tags_in_response(self, client, user):
        tag = Tag.objects.create(name='view-tag-create')
        client.force_authenticate(user=user)
        response = client.post(LIST_URL, make_story_payload(tag_ids=[tag.pk]), format='json')
        assert response.status_code == status.HTTP_201_CREATED
        tag_names = [t['name'] for t in response.data['tags']]
        assert 'view-tag-create' in tag_names

    def test_create_story_increments_tag_story_count(self, client, user):
        tag = Tag.objects.create(name='view-tag-count')
        client.force_authenticate(user=user)
        client.post(LIST_URL, make_story_payload(tag_ids=[tag.pk]), format='json')
        tag.refresh_from_db()
        assert tag.story_count == 1

    def test_create_story_with_too_many_tags_returns_400(self, client, user):
        tags = [Tag.objects.create(name=f'view-max-{i}') for i in range(4)]
        client.force_authenticate(user=user)
        response = client.post(LIST_URL, make_story_payload(tag_ids=[t.pk for t in tags]), format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_story_with_nonexistent_tag_id_returns_400(self, client, user):
        client.force_authenticate(user=user)
        response = client.post(LIST_URL, make_story_payload(tag_ids=[999999]), format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_story_with_duplicate_tag_ids_returns_400(self, client, user):
        tag = Tag.objects.create(name='view-dup-tag')
        client.force_authenticate(user=user)
        response = client.post(LIST_URL, make_story_payload(tag_ids=[tag.pk, tag.pk]), format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_patch_story_adds_tag(self, client, user, story):
        tag = Tag.objects.create(name='view-patch-add')
        client.force_authenticate(user=user)
        response = client.patch(self._detail_url(story.pk), {'tag_ids': [tag.pk]}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert StoryTag.objects.filter(story=story, tag=tag).exists()

    def test_patch_story_removes_old_tag_and_adds_new(self, client, user, story):
        tag_old = Tag.objects.create(name='view-patch-old')
        tag_new = Tag.objects.create(name='view-patch-new')
        StoryTag.objects.create(story=story, tag=tag_old)
        client.force_authenticate(user=user)
        response = client.patch(self._detail_url(story.pk), {'tag_ids': [tag_new.pk]}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert not StoryTag.objects.filter(story=story, tag=tag_old).exists()
        assert StoryTag.objects.filter(story=story, tag=tag_new).exists()

    def test_patch_story_without_tag_ids_leaves_existing_tags(self, client, user, story):
        tag = Tag.objects.create(name='view-patch-keep')
        StoryTag.objects.create(story=story, tag=tag)
        client.force_authenticate(user=user)
        response = client.patch(self._detail_url(story.pk), {'title': 'Updated'}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert StoryTag.objects.filter(story=story, tag=tag).exists()

    def test_patch_story_with_empty_tag_ids_removes_all_tags(self, client, user, story):
        tag = Tag.objects.create(name='view-patch-clear')
        StoryTag.objects.create(story=story, tag=tag)
        client.force_authenticate(user=user)
        response = client.patch(self._detail_url(story.pk), {'tag_ids': []}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert StoryTag.objects.filter(story=story).count() == 0

    def test_story_list_response_includes_tags_field(self, client, story):
        response = client.get(LIST_URL)
        assert response.status_code == status.HTTP_200_OK
        assert 'tags' in response.data['results'][0]

    def test_story_detail_response_includes_tags_field(self, client, story):
        response = client.get(self._detail_url(story.pk))
        assert response.status_code == status.HTTP_200_OK
        assert 'tags' in response.data


# ── Geo radius filter view tests ──────────────────────────────────────────────

# Center: Istanbul, Galata Tower area
_GEO_CENTER_LAT = 41.025580
_GEO_CENTER_LNG = 28.974180

# ~0.5 km north (inside 1 km radius)
_GEO_NEAR_LAT = 41.030073
_GEO_NEAR_LNG = _GEO_CENTER_LNG

# ~50 km north (outside any reasonable test radius)
_GEO_FAR_LAT = 41.474826
_GEO_FAR_LNG = _GEO_CENTER_LNG


def make_geo_story(lat, lng, **kwargs):
    defaults = dict(
        title='Geo Story',
        narrative='A geo narrative.',
        location_lat=str(lat),
        location_lng=str(lng),
        location_name='Test Location',
        time_type=Story.TIME_EXACT,
        year=1950,
        status=Story.STATUS_PUBLISHED,
    )
    defaults.update(kwargs)
    return Story.objects.create(**defaults)


@pytest.mark.django_db
class TestStoryFeedViewGeoFilter:
    def _geo_params(self, radius_km=1.0):
        return f'latitude={_GEO_CENTER_LAT}&longitude={_GEO_CENTER_LNG}&radius_km={radius_km}'

    def test_geo_filter_returns_only_nearby_stories(self, client):
        make_geo_story(_GEO_NEAR_LAT, _GEO_NEAR_LNG, title='Near Story')
        make_geo_story(_GEO_FAR_LAT, _GEO_FAR_LNG, title='Far Story')
        response = client.get(f'{FEED_URL}?{self._geo_params()}')
        assert response.status_code == status.HTTP_200_OK
        titles = [s['title'] for s in response.data['results']]
        assert 'Near Story' in titles
        assert 'Far Story' not in titles

    def test_geo_filter_unauthenticated_returns_200(self, client):
        response = client.get(f'{FEED_URL}?{self._geo_params()}')
        assert response.status_code == status.HTTP_200_OK

    def test_geo_filter_empty_results_when_no_stories_nearby(self, client):
        make_geo_story(_GEO_FAR_LAT, _GEO_FAR_LNG)
        response = client.get(f'{FEED_URL}?{self._geo_params()}')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 0

    def test_geo_filter_latitude_only_returns_400(self, client):
        response = client.get(f'{FEED_URL}?latitude={_GEO_CENTER_LAT}')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_geo_filter_latitude_and_longitude_without_radius_returns_400(self, client):
        response = client.get(f'{FEED_URL}?latitude={_GEO_CENTER_LAT}&longitude={_GEO_CENTER_LNG}')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_geo_filter_invalid_latitude_returns_400(self, client):
        response = client.get(f'{FEED_URL}?latitude=91&longitude={_GEO_CENTER_LNG}&radius_km=1')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_geo_filter_invalid_longitude_returns_400(self, client):
        response = client.get(f'{FEED_URL}?latitude={_GEO_CENTER_LAT}&longitude=200&radius_km=1')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_geo_filter_zero_radius_returns_400(self, client):
        response = client.get(f'{FEED_URL}?latitude={_GEO_CENTER_LAT}&longitude={_GEO_CENTER_LNG}&radius_km=0')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_geo_filter_negative_radius_returns_400(self, client):
        response = client.get(f'{FEED_URL}?latitude={_GEO_CENTER_LAT}&longitude={_GEO_CENTER_LNG}&radius_km=-1')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_geo_filter_combined_with_year_filter(self, client):
        make_geo_story(_GEO_NEAR_LAT, _GEO_NEAR_LNG, year=1900, title='OldNear')
        make_geo_story(_GEO_NEAR_LAT, _GEO_NEAR_LNG, year=2000, title='NewNear')
        response = client.get(f'{FEED_URL}?{self._geo_params()}&year_from=1950')
        assert response.status_code == status.HTTP_200_OK
        titles = [s['title'] for s in response.data['results']]
        assert 'NewNear' in titles
        assert 'OldNear' not in titles

    def test_geo_filter_combined_with_tag_filter(self, client):
        tag = Tag.objects.create(name='view-geo-tag')
        near_tagged = make_geo_story(_GEO_NEAR_LAT, _GEO_NEAR_LNG, title='TaggedNear')
        StoryTag.objects.create(story=near_tagged, tag=tag)
        make_geo_story(_GEO_NEAR_LAT, _GEO_NEAR_LNG, title='UntaggedNear')
        response = client.get(f'{FEED_URL}?{self._geo_params()}&tag=view-geo-tag')
        assert response.status_code == status.HTTP_200_OK
        titles = [s['title'] for s in response.data['results']]
        assert 'TaggedNear' in titles
        assert 'UntaggedNear' not in titles


@pytest.mark.django_db
class TestStoryMapViewGeoFilter:
    def _geo_params(self, radius_km=1.0):
        return f'latitude={_GEO_CENTER_LAT}&longitude={_GEO_CENTER_LNG}&radius_km={radius_km}'

    def _feature_ids(self, response):
        return [f['id'] for f in response.data['features']]

    def test_geo_filter_returns_only_nearby_features(self, client):
        near = make_geo_story(_GEO_NEAR_LAT, _GEO_NEAR_LNG)
        far = make_geo_story(_GEO_FAR_LAT, _GEO_FAR_LNG)
        response = client.get(f'{MAP_URL}?{self._geo_params()}')
        assert response.status_code == status.HTTP_200_OK
        ids = self._feature_ids(response)
        assert near.pk in ids
        assert far.pk not in ids

    def test_geo_filter_unauthenticated_returns_200(self, client):
        response = client.get(f'{MAP_URL}?{self._geo_params()}')
        assert response.status_code == status.HTTP_200_OK

    def test_geo_filter_missing_one_param_returns_400(self, client):
        response = client.get(f'{MAP_URL}?latitude={_GEO_CENTER_LAT}&longitude={_GEO_CENTER_LNG}')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_geo_filter_invalid_latitude_returns_400(self, client):
        response = client.get(f'{MAP_URL}?latitude=91&longitude={_GEO_CENTER_LNG}&radius_km=1')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_geo_filter_empty_results_when_no_stories_nearby(self, client):
        make_geo_story(_GEO_FAR_LAT, _GEO_FAR_LNG)
        response = client.get(f'{MAP_URL}?{self._geo_params()}')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['features'] == []

    def test_geo_filter_returns_geojson_feature_collection(self, client):
        make_geo_story(_GEO_NEAR_LAT, _GEO_NEAR_LNG)
        response = client.get(f'{MAP_URL}?{self._geo_params()}')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['type'] == 'FeatureCollection'
        assert response.data['features'][0]['type'] == 'Feature'


@pytest.mark.django_db
class TestStorySearchViewGeoFilter:
    def _geo_params(self, radius_km=1.0):
        return f'latitude={_GEO_CENTER_LAT}&longitude={_GEO_CENTER_LNG}&radius_km={radius_km}'

    def test_geo_filter_returns_only_nearby_matching_stories(self, client):
        make_geo_story(_GEO_NEAR_LAT, _GEO_NEAR_LNG, title='Ancient Tower')
        make_geo_story(_GEO_FAR_LAT, _GEO_FAR_LNG, title='Ancient Ruins')
        response = client.get(f'{SEARCH_URL}?q=Ancient&{self._geo_params()}')
        assert response.status_code == status.HTTP_200_OK
        titles = [s['title'] for s in response.data['results']]
        assert 'Ancient Tower' in titles
        assert 'Ancient Ruins' not in titles

    def test_geo_filter_unauthenticated_returns_200(self, client):
        response = client.get(f'{SEARCH_URL}?q=story&{self._geo_params()}')
        assert response.status_code == status.HTTP_200_OK

    def test_geo_filter_missing_one_param_returns_400(self, client):
        response = client.get(f'{SEARCH_URL}?q=story&latitude={_GEO_CENTER_LAT}')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_geo_filter_invalid_latitude_returns_400(self, client):
        response = client.get(f'{SEARCH_URL}?q=story&latitude=91&longitude={_GEO_CENTER_LNG}&radius_km=1')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_geo_filter_empty_results_when_no_matching_stories_nearby(self, client):
        make_geo_story(_GEO_FAR_LAT, _GEO_FAR_LNG, title='Ancient Far')
        response = client.get(f'{SEARCH_URL}?q=Ancient&{self._geo_params()}')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 0
