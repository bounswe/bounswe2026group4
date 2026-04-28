from decimal import Decimal

import pytest

from apps.stories.models import Story
from apps.interactions.models import Like, SavedStory
from apps.media.models import MediaItem, MediaType
from apps.stories.serializers import FeedQuerySerializer, SearchQuerySerializer, StoryDetailSerializer, StoryFeedSerializer, StoryMapGeoJSONSerializer, StorySerializer, TimelineQuerySerializer
from apps.tags.models import StoryTag, Tag
from apps.users.models import User


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_user(email='author@example.com', username='author'):
    return User.objects.create_user(email=email, username=username, password='Password1')


def make_story(user=None, **kwargs):
    defaults = dict(
        title='The Old Bridge',
        narrative='Once upon a time there was a bridge that connected two sides of the city.',
        location_lat='41.015137',
        location_lng='28.979530',
        location_name='Galata Bridge',
        time_type=Story.TIME_EXACT,
        year=1950,
    )
    defaults.update(kwargs)
    return Story.objects.create(user=user, **defaults)


def make_story_data(**overrides):
    data = {
        'title': 'The Old Bridge',
        'narrative': 'A story about the old bridge.',
        'location_lat': '41.015137',
        'location_lng': '28.979530',
        'location_name': 'Galata Bridge',
        'time_type': Story.TIME_EXACT,
        'year': 1950,
        'status': Story.STATUS_PUBLISHED,
    }
    data.update(overrides)
    return data


# ── StoryFeedSerializer ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStoryFeedSerializer:
    def test_returns_all_required_card_fields(self):
        story = make_story()
        data = StoryFeedSerializer(story).data
        expected_fields = {
            'id', 'title', 'location_name', 'location_lat', 'location_lng',
            'time_type', 'year', 'year_start', 'year_end',
            'status', 'contributor_name', 'preview_text',
            'user_has_liked', 'user_has_saved', 'submitted_at',
        }
        assert expected_fields == set(data.keys())

    def test_returns_preview_text_truncated_to_20_words(self):
        # Narrative has more than 20 words — preview must stop at exactly 20
        long_narrative = ' '.join([f'word{i}' for i in range(30)])
        story = make_story(narrative=long_narrative)
        data = StoryFeedSerializer(story).data
        assert len(data['preview_text'].split()) == 20

    def test_returns_full_text_when_narrative_is_shorter_than_20_words(self):
        story = make_story(narrative='Short story.')
        data = StoryFeedSerializer(story).data
        assert data['preview_text'] == 'Short story.'

    def test_shows_contributor_name_when_visible(self):
        user = make_user()
        story = make_story(user=user, contributor_visible=True)
        data = StoryFeedSerializer(story).data
        assert data['contributor_name'] == 'author'

    def test_hides_contributor_name_when_not_visible(self):
        user = make_user()
        story = make_story(user=user, contributor_visible=False)
        data = StoryFeedSerializer(story).data
        assert data['contributor_name'] is None

    def test_contributor_name_is_none_when_user_is_anonymized(self):
        # Story whose author account was deleted — user FK is null
        story = make_story(user=None, contributor_visible=True)
        data = StoryFeedSerializer(story).data
        assert data['contributor_name'] is None

    def test_returns_correct_title_and_location(self):
        story = make_story(title='Bosphorus Tales', location_name='Bosphorus Bridge')
        data = StoryFeedSerializer(story).data
        assert data['title'] == 'Bosphorus Tales'
        assert data['location_name'] == 'Bosphorus Bridge'

    def test_returns_year_range_fields(self):
        story = make_story(
            time_type=Story.TIME_RANGE,
            year=None,
            year_start=1940,
            year_end=1960,
        )
        data = StoryFeedSerializer(story).data
        assert data['time_type'] == Story.TIME_RANGE
        assert data['year_start'] == 1940
        assert data['year_end'] == 1960
        assert data['year'] is None

    def test_returns_correct_status(self):
        story = make_story(status=Story.STATUS_PUBLISHED)
        data = StoryFeedSerializer(story).data
        assert data['status'] == Story.STATUS_PUBLISHED


# ── StorySerializer ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStorySerializerFields:
    def test_serializer_contains_expected_fields(self, story):
        serializer = StorySerializer(story)
        expected = {
            'id', 'user', 'contributor_name', 'title', 'narrative',
            'location_lat', 'location_lng', 'location_name', 'region',
            'time_type', 'year', 'year_start', 'year_end',
            'status', 'contributor_visible', 'like_count', 'save_count',
            'user_has_liked', 'user_has_saved', 'submitted_at', 'updated_at',
            'tags',
        }
        assert set(serializer.data.keys()) == expected

    def test_read_only_fields_are_not_writable(self):
        data = make_story_data(like_count=999, save_count=999)
        serializer = StorySerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        assert 'like_count' not in serializer.validated_data
        assert 'save_count' not in serializer.validated_data

    def test_contributor_name_returns_username_when_visible(self):
        user = make_user()
        story = make_story(user=user, contributor_visible=True)
        data = StorySerializer(story).data
        assert data['contributor_name'] == user.username

    def test_contributor_name_is_none_when_not_visible(self):
        user = make_user()
        story = make_story(user=user, contributor_visible=False)
        data = StorySerializer(story).data
        assert data['contributor_name'] is None

    def test_contributor_name_is_none_when_user_is_anonymized(self):
        # Story whose author account was deleted — user FK is null
        story = make_story(user=None, contributor_visible=True)
        data = StorySerializer(story).data
        assert data['contributor_name'] is None


@pytest.mark.django_db
class TestStorySerializerValidation:
    def test_validate_status_blocks_removed(self):
        data = make_story_data(status=Story.STATUS_REMOVED)
        serializer = StorySerializer(data=data)
        assert not serializer.is_valid()
        assert 'status' in serializer.errors

    def test_validate_status_allows_draft(self):
        data = make_story_data(status=Story.STATUS_DRAFT)
        serializer = StorySerializer(data=data)
        assert serializer.is_valid(), serializer.errors

    def test_validate_status_allows_published(self):
        data = make_story_data(status=Story.STATUS_PUBLISHED)
        serializer = StorySerializer(data=data)
        assert serializer.is_valid(), serializer.errors

    def test_validate_raises_when_exact_year_and_year_missing(self):
        data = make_story_data(time_type=Story.TIME_EXACT, year=None)
        serializer = StorySerializer(data=data)
        assert not serializer.is_valid()
        assert 'year' in str(serializer.errors)

    def test_validate_raises_when_year_range_missing_year_start(self):
        data = make_story_data(time_type=Story.TIME_RANGE, year=None, year_start=None, year_end=1960)
        serializer = StorySerializer(data=data)
        assert not serializer.is_valid()
        assert 'year_start' in str(serializer.errors)

    def test_validate_raises_when_year_range_missing_year_end(self):
        data = make_story_data(time_type=Story.TIME_RANGE, year=None, year_start=1940, year_end=None)
        serializer = StorySerializer(data=data)
        assert not serializer.is_valid()
        assert 'year_end' in str(serializer.errors)

    def test_validate_passes_for_valid_year_range(self):
        data = make_story_data(time_type=Story.TIME_RANGE, year=None, year_start=1940, year_end=1960)
        serializer = StorySerializer(data=data)
        assert serializer.is_valid(), serializer.errors

    def test_partial_update_validate_uses_existing_instance_values(self, story):
        # A partial PATCH with only title should not fail year validation
        # because time_type and year are already set on the instance
        serializer = StorySerializer(story, data={'title': 'New Title'}, partial=True)
        assert serializer.is_valid(), serializer.errors


@pytest.mark.django_db
class TestStorySerializerCreate:
    def test_create_persists_story_with_correct_user(self, user):
        data = make_story_data()
        serializer = StorySerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        story = serializer.save(user=user)
        assert story.pk is not None
        assert story.user == user
        assert story.title == 'The Old Bridge'

    def test_create_returns_story_instance(self, user):
        serializer = StorySerializer(data=make_story_data())
        assert serializer.is_valid(), serializer.errors
        result = serializer.save(user=user)
        assert isinstance(result, Story)


@pytest.mark.django_db
class TestStorySerializerUpdate:
    def test_update_changes_specified_fields(self, story):
        serializer = StorySerializer(story, data={'title': 'Updated'}, partial=True)
        assert serializer.is_valid(), serializer.errors
        updated = serializer.save()
        assert updated.title == 'Updated'

    def test_update_does_not_change_unspecified_fields(self, story):
        original_narrative = story.narrative
        serializer = StorySerializer(story, data={'title': 'New Title'}, partial=True)
        assert serializer.is_valid(), serializer.errors
        serializer.save()
        story.refresh_from_db()
        assert story.narrative == original_narrative


# ── SearchQuerySerializer ─────────────────────────────────────────────────────

class TestSearchQuerySerializer:
    def test_valid_query_passes(self):
        s = SearchQuerySerializer(data={'q': 'Istanbul'})
        assert s.is_valid(), s.errors
        assert s.validated_data['q'] == 'Istanbul'

    def test_missing_q_fails(self):
        s = SearchQuerySerializer(data={})
        assert not s.is_valid()
        assert 'q' in s.errors

    def test_empty_string_fails(self):
        s = SearchQuerySerializer(data={'q': ''})
        assert not s.is_valid()
        assert 'q' in s.errors

    def test_whitespace_only_fails(self):
        # DRF CharField strips whitespace before min_length check, so '   ' becomes '' and fails
        s = SearchQuerySerializer(data={'q': '   '})
        assert not s.is_valid()
        assert 'q' in s.errors

    def test_single_character_passes(self):
        s = SearchQuerySerializer(data={'q': 'a'})
        assert s.is_valid(), s.errors

    def test_valid_with_all_filter_params(self):
        s = SearchQuerySerializer(data={
            'q': 'tower',
            'sort_by': 'recent',
            'year_from': 1900,
            'year_to': 2000,
            'location': 'istanbul',
        })
        assert s.is_valid(), s.errors
        assert s.validated_data['year_from'] == 1900
        assert s.validated_data['year_to'] == 2000
        assert s.validated_data['location'] == 'istanbul'

    def test_year_from_greater_than_year_to_fails(self):
        s = SearchQuerySerializer(data={'q': 'bridge', 'year_from': 2000, 'year_to': 1900})
        assert not s.is_valid()
        assert 'year_to' in str(s.errors)

    def test_invalid_sort_by_fails(self):
        s = SearchQuerySerializer(data={'q': 'bridge', 'sort_by': 'invalid'})
        assert not s.is_valid()
        assert 'sort_by' in s.errors

    def test_defaults_sort_by_to_recent_when_omitted(self):
        s = SearchQuerySerializer(data={'q': 'bridge'})
        assert s.is_valid(), s.errors
        assert s.validated_data['sort_by'] == 'recent'

    def test_filter_params_are_optional(self):
        # Only q provided — all other filter params should be absent from validated_data
        s = SearchQuerySerializer(data={'q': 'galata'})
        assert s.is_valid(), s.errors
        assert 'year_from' not in s.validated_data
        assert 'year_to' not in s.validated_data
        assert 'location' not in s.validated_data



# ── StoryDetailSerializer ─────────────────────────────────────────────────────

def make_media_item(story, media_type=MediaType.IMAGE, order=0):
    """Create a MediaItem attached to *story* without writing anything to disk.

    FileField stores only a path string in the DB; the .url property works as
    long as we set a non-empty name — no actual file is needed for unit tests.
    """
    return MediaItem.objects.create(
        story=story,
        media_type=media_type,
        file_size=1024,
        original_filename='photo.jpg',
        order=order,
        file='stories/2024/01/photo.jpg',
    )


@pytest.mark.django_db
class TestStoryDetailSerializer:
    def _make_story(self, **kwargs):
        user = make_user()
        return make_story(user=user, **kwargs)

    def test_media_items_is_empty_list_when_no_media(self):
        story = self._make_story()
        data = StoryDetailSerializer(story).data
        assert data['media_items'] == []

    def test_media_items_contains_uploaded_files(self):
        story = self._make_story()
        item = make_media_item(story)
        data = StoryDetailSerializer(story).data
        assert len(data['media_items']) == 1
        assert data['media_items'][0]['id'] == item.id
        assert data['media_items'][0]['media_type'] == MediaType.IMAGE
        assert data['media_items'][0]['order'] == 0

    def test_media_items_ordered_by_order_field(self):
        story = self._make_story()
        make_media_item(story, order=1)
        make_media_item(story, order=0)
        data = StoryDetailSerializer(story).data
        orders = [item['order'] for item in data['media_items']]
        assert orders == sorted(orders)

    def test_media_item_url_is_absolute_when_request_in_context(self):
        from rest_framework.test import APIRequestFactory  # noqa: PLC0415
        story = self._make_story()
        make_media_item(story)
        request = APIRequestFactory().get('/')
        data = StoryDetailSerializer(story, context={'request': request}).data
        url = data['media_items'][0]['url']
        assert url.startswith('http')


# ── user_has_liked / user_has_saved — StorySerializer ────────────────────────

@pytest.mark.django_db
class TestStorySerializerUserInteractionFields:
    def _make_story_and_user(self):
        user = make_user()
        story = make_story(user=user)
        return story, user

    def test_user_has_liked_is_false_when_no_request_context(self):
        story, _ = self._make_story_and_user()
        data = StorySerializer(story).data
        assert data['user_has_liked'] is False

    def test_user_has_liked_is_true_when_user_liked(self):
        from rest_framework.test import APIRequestFactory
        story, user = self._make_story_and_user()
        Like.objects.create(user=user, story=story)
        request = APIRequestFactory().get('/')
        request.user = user
        data = StorySerializer(story, context={'request': request}).data
        assert data['user_has_liked'] is True

    def test_user_has_liked_is_false_when_user_not_liked(self):
        from rest_framework.test import APIRequestFactory
        story, user = self._make_story_and_user()
        request = APIRequestFactory().get('/')
        request.user = user
        data = StorySerializer(story, context={'request': request}).data
        assert data['user_has_liked'] is False

    def test_user_has_saved_is_true_when_user_saved(self):
        from rest_framework.test import APIRequestFactory
        story, user = self._make_story_and_user()
        SavedStory.objects.create(user=user, story=story)
        request = APIRequestFactory().get('/')
        request.user = user
        data = StorySerializer(story, context={'request': request}).data
        assert data['user_has_saved'] is True

    def test_user_has_saved_is_false_when_user_not_saved(self):
        from rest_framework.test import APIRequestFactory
        story, user = self._make_story_and_user()
        request = APIRequestFactory().get('/')
        request.user = user
        data = StorySerializer(story, context={'request': request}).data
        assert data['user_has_saved'] is False

    def test_reads_user_has_liked_from_annotation_when_present(self):
        # When the queryset is annotated (feed/search views), the serializer must
        # use the pre-computed value instead of firing an extra DB query.
        story, _ = self._make_story_and_user()
        story._user_has_liked = True
        story._user_has_saved = False
        data = StorySerializer(story).data
        assert data['user_has_liked'] is True
        assert data['user_has_saved'] is False

    def test_reads_user_has_saved_from_annotation_when_present(self):
        story, _ = self._make_story_and_user()
        story._user_has_liked = False
        story._user_has_saved = True
        data = StorySerializer(story).data
        assert data['user_has_liked'] is False
        assert data['user_has_saved'] is True


# ── user_has_liked / user_has_saved — StoryFeedSerializer ────────────────────

@pytest.mark.django_db
class TestStoryFeedSerializerUserInteractionFields:
    def _make_story_and_user(self):
        user = make_user()
        story = make_story(user=user)
        return story, user

    def test_user_has_liked_is_false_when_no_request_context(self):
        story, _ = self._make_story_and_user()
        data = StoryFeedSerializer(story).data
        assert data['user_has_liked'] is False

    def test_user_has_liked_is_true_when_user_liked(self):
        from rest_framework.test import APIRequestFactory
        story, user = self._make_story_and_user()
        Like.objects.create(user=user, story=story)
        request = APIRequestFactory().get('/')
        request.user = user
        data = StoryFeedSerializer(story, context={'request': request}).data
        assert data['user_has_liked'] is True

    def test_user_has_liked_is_false_when_user_not_liked(self):
        from rest_framework.test import APIRequestFactory
        story, user = self._make_story_and_user()
        request = APIRequestFactory().get('/')
        request.user = user
        data = StoryFeedSerializer(story, context={'request': request}).data
        assert data['user_has_liked'] is False

    def test_user_has_saved_is_true_when_user_saved(self):
        from rest_framework.test import APIRequestFactory
        story, user = self._make_story_and_user()
        SavedStory.objects.create(user=user, story=story)
        request = APIRequestFactory().get('/')
        request.user = user
        data = StoryFeedSerializer(story, context={'request': request}).data
        assert data['user_has_saved'] is True

    def test_user_has_saved_is_false_when_user_not_saved(self):
        from rest_framework.test import APIRequestFactory
        story, user = self._make_story_and_user()
        request = APIRequestFactory().get('/')
        request.user = user
        data = StoryFeedSerializer(story, context={'request': request}).data
        assert data['user_has_saved'] is False

    def test_reads_user_has_liked_from_annotation_when_present(self):
        # When the queryset is annotated (feed/search views), the serializer must
        # use the pre-computed value instead of firing an extra DB query.
        story, _ = self._make_story_and_user()
        story._user_has_liked = True
        story._user_has_saved = False
        data = StoryFeedSerializer(story).data
        assert data['user_has_liked'] is True
        assert data['user_has_saved'] is False

    def test_reads_user_has_saved_from_annotation_when_present(self):
        story, _ = self._make_story_and_user()
        story._user_has_liked = False
        story._user_has_saved = True
        data = StoryFeedSerializer(story).data
        assert data['user_has_liked'] is False
        assert data['user_has_saved'] is True


# ── StoryMapGeoJSONSerializer ─────────────────────────────────────────────

@pytest.mark.django_db
class TestStoryMapGeoJSONSerializer:
    def _make_story(self, **kwargs):
        user = make_user()
        return make_story(user=user, **kwargs)

    def test_feature_has_required_geojson_keys(self):
        story = self._make_story()
        data = StoryMapGeoJSONSerializer(story).data
        assert data['type'] == 'Feature'
        assert data['id'] == story.id
        assert 'geometry' in data
        assert 'properties' in data

    def test_geometry_is_point_with_coordinates(self):
        story = self._make_story(location_lat='41.015137', location_lng='28.979530')
        data = StoryMapGeoJSONSerializer(story).data
        assert data['geometry']['type'] == 'Point'
        assert len(data['geometry']['coordinates']) == 2

    def test_coordinates_are_lng_lat_order(self):
        # RFC 7946 §3.1.1 mandates [longitude, latitude] ordering
        story = self._make_story(location_lat='41.015137', location_lng='28.979530')
        data = StoryMapGeoJSONSerializer(story).data
        coords = data['geometry']['coordinates']
        assert coords[0] == pytest.approx(28.979530)
        assert coords[1] == pytest.approx(41.015137)

    def test_coordinates_are_float_not_decimal_strings(self):
        story = self._make_story(location_lat='41.015137', location_lng='28.979530')
        data = StoryMapGeoJSONSerializer(story).data
        coords = data['geometry']['coordinates']
        assert isinstance(coords[0], float)
        assert isinstance(coords[1], float)

    def test_properties_contains_required_fields(self):
        story = self._make_story(title='Bridge', location_name='Galata', time_type=Story.TIME_EXACT, year=1950)
        data = StoryMapGeoJSONSerializer(story).data
        props = data['properties']
        assert props['title'] == 'Bridge'
        assert props['location_name'] == 'Galata'
        assert props['time_type'] == Story.TIME_EXACT
        assert props['year'] == 1950
        assert props['year_start'] is None
        assert props['year_end'] is None

    def test_properties_contains_year_range_fields(self):
        story = self._make_story(
            time_type=Story.TIME_RANGE,
            year=None,
            year_start=1950,
            year_end=1970,
        )
        data = StoryMapGeoJSONSerializer(story).data
        props = data['properties']
        assert props['year_start'] == 1950
        assert props['year_end'] == 1970

    def test_many_true_returns_list_of_features(self):
        make_story(user=make_user(email='u1@example.com', username='u1'))
        make_story(user=make_user(email='u2@example.com', username='u2'))
        qs = Story.objects.all()
        data = StoryMapGeoJSONSerializer(qs, many=True).data
        assert len(data) == 2
        assert all(f['type'] == 'Feature' for f in data)


# ── StorySerializer — tag_ids / tags ──────────────────────────────────────────

@pytest.mark.django_db
class TestStorySerializerTags:
    """Tests for tag_ids write field and tags read field on StorySerializer."""

    def _serializer(self, data, instance=None):
        user = make_user(email='tag-ser@example.com', username='tagser')
        request = type('R', (), {'user': user})()
        return StorySerializer(
            instance=instance,
            data=data,
            context={'request': request},
            partial=instance is not None,
        )

    def _story(self):
        user = make_user(email='tag-story@example.com', username='tagstory')
        return make_story(user=user)

    def test_tag_ids_accepted_on_create(self):
        tag = Tag.objects.create(name='ser-create-tag')
        data = make_story_data(tag_ids=[tag.pk])
        s = self._serializer(data)
        assert s.is_valid(), s.errors

    def test_tag_ids_optional_on_create(self):
        data = make_story_data()  # no tag_ids key
        s = self._serializer(data)
        assert s.is_valid(), s.errors

    def test_tag_ids_max_3_enforced(self):
        tags = [Tag.objects.create(name=f'ser-max-{i}') for i in range(4)]
        data = make_story_data(tag_ids=[t.pk for t in tags])
        s = self._serializer(data)
        assert not s.is_valid()
        assert 'tag_ids' in s.errors

    def test_tag_ids_duplicate_rejected(self):
        tag = Tag.objects.create(name='ser-dup-tag')
        data = make_story_data(tag_ids=[tag.pk, tag.pk])
        s = self._serializer(data)
        assert not s.is_valid()
        assert 'tag_ids' in s.errors

    def test_tag_ids_nonexistent_rejected(self):
        data = make_story_data(tag_ids=[999999])
        s = self._serializer(data)
        assert not s.is_valid()
        assert 'tag_ids' in s.errors

    def test_tags_read_field_present_in_output(self):
        story = self._story()
        tag = Tag.objects.create(name='ser-read-tag')
        StoryTag.objects.create(story=story, tag=tag)
        data = StorySerializer(story).data
        assert 'tags' in data
        assert data['tags'][0]['name'] == 'ser-read-tag'

    def test_tag_ids_absent_in_patch_leaves_tags_unchanged(self):
        story = self._story()
        tag = Tag.objects.create(name='ser-unchanged-tag')
        StoryTag.objects.create(story=story, tag=tag)
        # PATCH without tag_ids — serializer should not include tag_ids in validated_data
        s = self._serializer({'title': 'New Title'}, instance=story)
        assert s.is_valid(), s.errors
        assert 'tag_ids' not in s.validated_data

    def test_empty_tag_ids_in_patch_is_valid(self):
        story = self._story()
        s = self._serializer({'tag_ids': []}, instance=story)
        assert s.is_valid(), s.errors
        assert s.validated_data['tag_ids'] == []


# ── FeedQuerySerializer geo validation ────────────────────────────────────────

class TestFeedQuerySerializerGeoValidation:
    """Tests for latitude/longitude/radius_km cross-field validation."""

    def _valid(self, data):
        s = FeedQuerySerializer(data=data)
        assert s.is_valid(), s.errors
        return s.validated_data

    def _invalid(self, data):
        s = FeedQuerySerializer(data=data)
        assert not s.is_valid()
        return s.errors

    # ── Positive cases ────────────────────────────────────────────────────────

    def test_all_three_geo_params_is_valid(self):
        self._valid({'latitude': 41.015, 'longitude': 28.979, 'radius_km': 1.0})

    def test_no_geo_params_is_valid(self):
        self._valid({})

    def test_no_geo_params_with_other_filters_is_valid(self):
        self._valid({'sort_by': 'popular', 'year_from': 1900, 'year_to': 2000})

    def test_radius_km_accepts_common_values(self):
        for radius in [0.5, 1.0, 2.0, 5.0, 10.0]:
            self._valid({'latitude': 41.0, 'longitude': 29.0, 'radius_km': radius})

    def test_geo_params_combined_with_year_filter_is_valid(self):
        self._valid({
            'latitude': 41.0, 'longitude': 29.0, 'radius_km': 1.0,
            'year_from': 1900, 'year_to': 2000,
        })

    def test_geo_params_combined_with_tag_filter_is_valid(self):
        self._valid({'latitude': 41.0, 'longitude': 29.0, 'radius_km': 1.0, 'tag': 'ottoman'})

    # ── Partial geo param sets rejected ──────────────────────────────────────

    def test_latitude_only_is_invalid(self):
        errors = self._invalid({'latitude': 41.0})
        assert 'longitude' in errors
        assert 'radius_km' in errors

    def test_longitude_only_is_invalid(self):
        errors = self._invalid({'longitude': 29.0})
        assert 'latitude' in errors
        assert 'radius_km' in errors

    def test_radius_km_only_is_invalid(self):
        errors = self._invalid({'radius_km': 1.0})
        assert 'latitude' in errors
        assert 'longitude' in errors

    def test_latitude_and_longitude_without_radius_is_invalid(self):
        errors = self._invalid({'latitude': 41.0, 'longitude': 29.0})
        assert 'radius_km' in errors

    def test_latitude_and_radius_without_longitude_is_invalid(self):
        errors = self._invalid({'latitude': 41.0, 'radius_km': 1.0})
        assert 'longitude' in errors

    def test_longitude_and_radius_without_latitude_is_invalid(self):
        errors = self._invalid({'longitude': 29.0, 'radius_km': 1.0})
        assert 'latitude' in errors

    # ── Field-level range validation ──────────────────────────────────────────

    def test_latitude_above_90_is_invalid(self):
        errors = self._invalid({'latitude': 91.0, 'longitude': 29.0, 'radius_km': 1.0})
        assert 'latitude' in errors

    def test_latitude_below_minus_90_is_invalid(self):
        errors = self._invalid({'latitude': -91.0, 'longitude': 29.0, 'radius_km': 1.0})
        assert 'latitude' in errors

    def test_latitude_at_boundary_values_is_valid(self):
        self._valid({'latitude': 90.0, 'longitude': 0.0, 'radius_km': 1.0})
        self._valid({'latitude': -90.0, 'longitude': 0.0, 'radius_km': 1.0})

    def test_longitude_above_180_is_invalid(self):
        errors = self._invalid({'latitude': 41.0, 'longitude': 181.0, 'radius_km': 1.0})
        assert 'longitude' in errors

    def test_longitude_below_minus_180_is_invalid(self):
        errors = self._invalid({'latitude': 41.0, 'longitude': -181.0, 'radius_km': 1.0})
        assert 'longitude' in errors

    def test_longitude_at_boundary_values_is_valid(self):
        self._valid({'latitude': 0.0, 'longitude': 180.0, 'radius_km': 1.0})
        self._valid({'latitude': 0.0, 'longitude': -180.0, 'radius_km': 1.0})

    def test_radius_km_of_zero_is_invalid(self):
        errors = self._invalid({'latitude': 41.0, 'longitude': 29.0, 'radius_km': 0.0})
        assert 'radius_km' in errors

    def test_radius_km_negative_is_invalid(self):
        errors = self._invalid({'latitude': 41.0, 'longitude': 29.0, 'radius_km': -1.0})
        assert 'radius_km' in errors

    def test_geo_and_year_cross_field_validation_coexist(self):
        # Both cross-field checks must run independently
        errors = self._invalid({
            'latitude': 41.0, 'longitude': 29.0, 'radius_km': 1.0,
            'year_from': 2000, 'year_to': 1900,
        })
        assert 'year_to' in errors

    # ── SearchQuerySerializer inherits geo validation ─────────────────────────

    def test_search_serializer_inherits_geo_validation(self):
        s = SearchQuerySerializer(data={'q': 'bridge', 'latitude': 41.0})
        assert not s.is_valid()
        assert 'longitude' in s.errors or 'radius_km' in s.errors

    def test_search_serializer_accepts_all_three_geo_params(self):
        s = SearchQuerySerializer(
            data={'q': 'bridge', 'latitude': 41.0, 'longitude': 29.0, 'radius_km': 2.0}
        )
        assert s.is_valid(), s.errors

    def test_radius_km_at_max_is_valid(self):
        self._valid({'latitude': 41.0, 'longitude': 29.0, 'radius_km': 500.0})

    def test_radius_km_above_max_is_invalid(self):
        errors = self._invalid({'latitude': 41.0, 'longitude': 29.0, 'radius_km': 501.0})
        assert 'radius_km' in errors


# ── TimelineQuerySerializer ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTimelineQuerySerializer:
    def test_all_fields_optional(self):
        s = TimelineQuerySerializer(data={})
        assert s.is_valid(), s.errors

    def test_accepts_valid_year_range(self):
        s = TimelineQuerySerializer(data={'year_from': 1800, 'year_to': 1900})
        assert s.is_valid(), s.errors

    def test_rejects_year_to_less_than_year_from(self):
        s = TimelineQuerySerializer(data={'year_from': 1900, 'year_to': 1800})
        assert not s.is_valid()
        assert 'year_to' in s.errors

    def test_accepts_full_bbox(self):
        s = TimelineQuerySerializer(data={
            'lat_min': 40.9, 'lat_max': 41.2, 'lng_min': 28.7, 'lng_max': 29.2,
        })
        assert s.is_valid(), s.errors

    def test_rejects_partial_bbox(self):
        s = TimelineQuerySerializer(data={'lat_min': 40.9, 'lat_max': 41.2})
        assert not s.is_valid()
        assert 'lng_min' in s.errors or 'lng_max' in s.errors

    def test_accepts_has_image_true(self):
        s = TimelineQuerySerializer(data={'has_image': True})
        assert s.is_valid(), s.errors
        assert s.validated_data['has_image'] is True

    def test_has_image_defaults_to_none_when_omitted(self):
        s = TimelineQuerySerializer(data={})
        assert s.is_valid(), s.errors
        assert s.validated_data.get('has_image') is None

    def test_has_no_sort_by_field(self):
        s = TimelineQuerySerializer(data={'sort_by': 'recent'})
        assert s.is_valid()
        assert 'sort_by' not in s.validated_data
