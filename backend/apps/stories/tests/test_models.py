import datetime

import pytest

from apps.stories.models import Story
from apps.users.models import User


def make_user(email='author@example.com', username='author'):
    return User.objects.create_user(email=email, username=username, password='Password1')


def make_story(**kwargs):
    """Create a minimal valid Story. Override fields via kwargs."""
    defaults = dict(
        title='The Old Bridge',
        narrative='A story about the old bridge that stood for centuries.',
        location_lat='41.015137',
        location_lng='28.979530',
        location_name='Galata Bridge',
        time_type=Story.TIME_EXACT,
        year=1950,
    )
    defaults.update(kwargs)
    return Story.objects.create(**defaults)


@pytest.mark.django_db
class TestStoryModel:
    def test_create_story_with_required_fields_succeeds(self):
        user = make_user()
        story = make_story(user=user)
        assert story.pk is not None
        assert story.title == 'The Old Bridge'
        assert story.narrative == 'A story about the old bridge that stood for centuries.'
        assert story.location_name == 'Galata Bridge'

    def test_create_story_without_user_succeeds(self):
        # user=None is the anonymized state — valid because account deletion uses SET_NULL
        story = make_story(user=None)
        assert story.user is None
        assert story.pk is not None

    def test_create_story_defaults_to_published_status(self):
        story = make_story()
        assert story.status == Story.STATUS_PUBLISHED

    def test_contributor_visible_defaults_to_true(self):
        story = make_story()
        assert story.contributor_visible is True

    def test_moderation_reason_defaults_to_empty_string(self):
        story = make_story()
        assert story.moderation_reason == ''

    def test_like_count_and_save_count_default_to_zero(self):
        story = make_story()
        assert story.like_count == 0
        assert story.save_count == 0

    def test_region_defaults_to_empty_string(self):
        story = make_story()
        assert story.region == ''

    def test_create_story_with_region(self):
        story = make_story(region='Beyoglu')
        assert story.region == 'Beyoglu'

    def test_create_story_with_year_range_time_type(self):
        story = make_story(
            time_type=Story.TIME_RANGE,
            year=None,
            year_start=1940,
            year_end=1960,
        )
        assert story.time_type == Story.TIME_RANGE
        assert story.year_start == 1940
        assert story.year_end == 1960

    def test_create_story_with_decade_time_type(self):
        # year stores the decade base, e.g. 1980 represents "1980s"
        story = make_story(time_type=Story.TIME_DECADE, year=1980)
        assert story.time_type == Story.TIME_DECADE
        assert story.year == 1980

    def test_create_story_with_approximate_year_time_type(self):
        story = make_story(time_type=Story.TIME_APPROXIMATE, year=1955)
        assert story.time_type == Story.TIME_APPROXIMATE
        assert story.year == 1955

    def test_story_user_set_null_after_account_deletion(self):
        # Deleting a user account anonymizes their stories — stories are not removed
        user = make_user()
        story = make_story(user=user)
        user.delete()
        story.refresh_from_db()
        assert story.user is None
        assert Story.objects.filter(pk=story.pk).exists()

    def test_story_str_returns_title(self):
        story = make_story(title='The Clock Tower')
        assert str(story) == 'The Clock Tower'

    def test_create_story_with_removed_status(self):
        story = make_story(status=Story.STATUS_REMOVED, moderation_reason='Spam content.')
        assert story.status == Story.STATUS_REMOVED
        assert story.moderation_reason == 'Spam content.'

    def test_create_story_with_draft_status(self):
        story = make_story(status=Story.STATUS_DRAFT)
        assert story.status == Story.STATUS_DRAFT

    def test_create_story_with_blank_title_fails_validation(self):
        # CharField blank=False is enforced by full_clean(), not at DB level
        from django.core.exceptions import ValidationError
        story = Story(
            title='',
            narrative='Some narrative',
            location_lat='41.0',
            location_lng='28.9',
            location_name='Somewhere',
            time_type=Story.TIME_EXACT,
            year=2000,
        )
        with pytest.raises(ValidationError):
            story.full_clean()

    def test_clean_raises_when_year_range_missing_year_end(self):
        from django.core.exceptions import ValidationError
        story = Story(
            title='Test',
            narrative='Narrative',
            location_lat='41.0',
            location_lng='28.9',
            location_name='Somewhere',
            time_type=Story.TIME_RANGE,
            year_start=1940,
            year_end=None,
        )
        with pytest.raises(ValidationError, match='year_end'):
            story.clean()

    def test_clean_raises_when_exact_year_missing_year(self):
        from django.core.exceptions import ValidationError
        story = Story(
            title='Test',
            narrative='Narrative',
            location_lat='41.0',
            location_lng='28.9',
            location_name='Somewhere',
            time_type=Story.TIME_EXACT,
            year=None,
        )
        with pytest.raises(ValidationError, match='year'):
            story.clean()

    def test_create_story_with_exact_date_only(self):
        story = make_story(
            time_type=Story.TIME_DATE,
            year=None,
            date_value=datetime.date(1990, 5, 12),
        )
        assert story.time_type == Story.TIME_DATE
        assert story.date_value == datetime.date(1990, 5, 12)
        assert story.time_value is None

    def test_create_story_with_exact_date_and_time(self):
        story = make_story(
            time_type=Story.TIME_DATE,
            year=None,
            date_value=datetime.date(1990, 5, 12),
            time_value=datetime.time(14, 30),
        )
        assert story.time_type == Story.TIME_DATE
        assert story.date_value == datetime.date(1990, 5, 12)
        assert story.time_value == datetime.time(14, 30)

    def test_clean_raises_when_exact_date_missing_date_value(self):
        from django.core.exceptions import ValidationError
        story = Story(
            title='Test',
            narrative='Narrative',
            location_lat='41.0',
            location_lng='28.9',
            location_name='Somewhere',
            time_type=Story.TIME_DATE,
            date_value=None,
        )
        with pytest.raises(ValidationError, match='date_value'):
            story.clean()
