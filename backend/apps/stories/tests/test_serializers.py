import pytest

from apps.stories.models import Story
from apps.stories.serializers import StoryFeedSerializer
from apps.users.models import User


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
