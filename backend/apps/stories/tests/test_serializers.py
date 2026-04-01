from decimal import Decimal

import pytest

from apps.stories.models import Story
from apps.stories.serializers import SearchQuerySerializer, StoryFeedSerializer, StoryMapSerializer, StorySerializer
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
            'status', 'contributor_name', 'preview_text', 'submitted_at',
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
            'submitted_at', 'updated_at',
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


# ── StoryMapSerializer ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStoryMapSerializer:
    MAP_FIELDS = {
        'id', 'title', 'location_name', 'location_lat', 'location_lng',
        'time_type', 'year', 'year_start', 'year_end',
    }
    EXCLUDED_FIELDS = {
        'narrative', 'contributor_name', 'preview_text', 'status',
        'like_count', 'save_count', 'submitted_at', 'updated_at',
        'region', 'contributor_visible', 'user',
    }

    def _make_story(self, **kwargs):
        user = make_user()
        return make_story(user=user, **kwargs)

    def test_contains_exactly_required_map_fields(self):
        story = self._make_story()
        data = StoryMapSerializer(story).data
        assert set(data.keys()) == self.MAP_FIELDS

    def test_excludes_heavy_fields(self):
        story = self._make_story()
        data = StoryMapSerializer(story).data
        for field in self.EXCLUDED_FIELDS:
            assert field not in data

    def test_coordinates_are_present_and_correct(self):
        story = self._make_story(
            location_lat='41.015137', location_lng='28.979530',
            location_name='Galata Bridge',
        )
        data = StoryMapSerializer(story).data
        assert str(data['location_lat']) == '41.015137'
        assert str(data['location_lng']) == '28.979530'
        assert data['location_name'] == 'Galata Bridge'

    def test_exact_year_story_has_year_set(self):
        story = self._make_story(time_type=Story.TIME_EXACT, year=1923)
        data = StoryMapSerializer(story).data
        assert data['time_type'] == Story.TIME_EXACT
        assert data['year'] == 1923
        assert data['year_start'] is None
        assert data['year_end'] is None

    def test_year_range_story_has_year_start_and_end(self):
        story = self._make_story(
            time_type=Story.TIME_RANGE, year=None, year_start=1900, year_end=1950,
        )
        data = StoryMapSerializer(story).data
        assert data['time_type'] == Story.TIME_RANGE
        assert data['year'] is None
        assert data['year_start'] == 1900
        assert data['year_end'] == 1950
