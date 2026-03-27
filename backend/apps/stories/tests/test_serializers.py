from decimal import Decimal

import pytest

from apps.stories.models import Story
from apps.stories.serializers import StorySerializer


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


@pytest.mark.django_db
class TestStorySerializerFields:
    def test_serializer_contains_expected_fields(self, story):
        serializer = StorySerializer(story)
        expected = {
            'id', 'user', 'title', 'narrative', 'location_lat', 'location_lng',
            'location_name', 'region', 'time_type', 'year', 'year_start', 'year_end',
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
