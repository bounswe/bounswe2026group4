from decimal import Decimal

import pytest

from apps.stories.models import Story
from apps.stories.services import create_story, update_story


def make_story_data(**overrides):
    data = {
        'title': 'The Old Bridge',
        'narrative': 'A story about the old bridge.',
        'location_lat': Decimal('41.015137'),
        'location_lng': Decimal('28.979530'),
        'location_name': 'Galata Bridge',
        'time_type': Story.TIME_EXACT,
        'year': 1950,
        'status': Story.STATUS_PUBLISHED,
    }
    data.update(overrides)
    return data


@pytest.mark.django_db
class TestCreateStory:
    def test_create_story_returns_story_instance(self, user):
        story = create_story(user=user, validated_data=make_story_data())
        assert isinstance(story, Story)

    def test_create_story_persists_to_database(self, user):
        story = create_story(user=user, validated_data=make_story_data())
        assert Story.objects.filter(pk=story.pk).exists()

    def test_create_story_sets_correct_user(self, user):
        story = create_story(user=user, validated_data=make_story_data())
        assert story.user == user

    def test_create_story_sets_correct_fields(self, user):
        story = create_story(user=user, validated_data=make_story_data(title='My Story'))
        assert story.title == 'My Story'
        assert story.location_name == 'Galata Bridge'
        assert story.year == 1950

    def test_create_story_with_null_user(self):
        # user=None is valid — represents an anonymized account
        story = create_story(user=None, validated_data=make_story_data())
        assert story.user is None
        assert story.pk is not None


@pytest.mark.django_db
class TestUpdateStory:
    def test_update_story_returns_story_instance(self, story):
        result = update_story(story=story, validated_data={'title': 'New Title'})
        assert isinstance(result, Story)

    def test_update_story_persists_changes(self, story):
        update_story(story=story, validated_data={'title': 'Updated', 'region': 'Beyoglu'})
        story.refresh_from_db()
        assert story.title == 'Updated'
        assert story.region == 'Beyoglu'

    def test_update_story_does_not_affect_unspecified_fields(self, story):
        original_narrative = story.narrative
        update_story(story=story, validated_data={'title': 'New Title'})
        story.refresh_from_db()
        assert story.narrative == original_narrative

    def test_update_story_can_change_status_to_draft(self, story):
        update_story(story=story, validated_data={'status': Story.STATUS_DRAFT})
        story.refresh_from_db()
        assert story.status == Story.STATUS_DRAFT
