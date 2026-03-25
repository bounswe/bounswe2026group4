import pytest

from apps.stories.models import Story
from apps.stories.services import get_story_feed
from apps.users.models import User


def make_user():
    return User.objects.create_user(
        email='author@example.com',
        username='author',
        password='Password1',
    )


def make_story(**kwargs):
    """Create a published story with sensible defaults. Override via kwargs."""
    defaults = dict(
        title='Test Story',
        narrative='A narrative.',
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
class TestGetStoryFeed:
    def test_returns_only_published_stories(self):
        make_story(status=Story.STATUS_PUBLISHED)
        make_story(status=Story.STATUS_DRAFT, title='Draft Story')
        make_story(status=Story.STATUS_REMOVED, title='Removed Story')
        qs = get_story_feed()
        assert qs.count() == 1
        assert qs.first().status == Story.STATUS_PUBLISHED

    def test_excludes_removed_stories(self):
        make_story(status=Story.STATUS_REMOVED)
        assert get_story_feed().count() == 0

    def test_excludes_draft_stories(self):
        make_story(status=Story.STATUS_DRAFT)
        assert get_story_feed().count() == 0

    def test_with_no_filters_returns_all_published(self):
        make_story(title='Story A')
        make_story(title='Story B')
        make_story(title='Story C')
        assert get_story_feed().count() == 3

    def test_sorts_by_most_recent(self):
        # Create three stories — Django ordering by submitted_at DESC means newest first.
        # We verify the queryset order matches submission order in reverse.
        s1 = make_story(title='Oldest')
        s2 = make_story(title='Middle')
        s3 = make_story(title='Newest')
        results = list(get_story_feed(sort_by='recent'))
        assert results[0] == s3
        assert results[1] == s2
        assert results[2] == s1

    def test_filters_by_year_from(self):
        make_story(title='Before', year=1940)
        make_story(title='After', year=1960)
        qs = get_story_feed(year_from=1950)
        assert qs.count() == 1
        assert qs.first().title == 'After'

    def test_filters_by_year_to(self):
        make_story(title='Before', year=1940)
        make_story(title='After', year=1960)
        qs = get_story_feed(year_to=1950)
        assert qs.count() == 1
        assert qs.first().title == 'Before'

    def test_filters_by_year_from_and_year_to(self):
        make_story(title='Too Early', year=1900)
        make_story(title='In Range', year=1950)
        make_story(title='Too Late', year=2000)
        qs = get_story_feed(year_from=1930, year_to=1970)
        assert qs.count() == 1
        assert qs.first().title == 'In Range'

    def test_filters_year_range_stories_by_year_from(self):
        # A year_range story with year_end=1960 should appear when year_from=1950
        make_story(
            time_type=Story.TIME_RANGE,
            year=None,
            year_start=1940,
            year_end=1960,
        )
        assert get_story_feed(year_from=1950).count() == 1

    def test_filters_year_range_stories_by_year_to(self):
        # A year_range story with year_start=1940 should appear when year_to=1950
        make_story(
            time_type=Story.TIME_RANGE,
            year=None,
            year_start=1940,
            year_end=1960,
        )
        assert get_story_feed(year_to=1950).count() == 1

    def test_excludes_year_range_story_entirely_outside_window(self):
        # year_range 1900–1920 should not appear for year_from=1950
        make_story(
            time_type=Story.TIME_RANGE,
            year=None,
            year_start=1900,
            year_end=1920,
        )
        assert get_story_feed(year_from=1950).count() == 0

    def test_filters_by_location_name_exact_match(self):
        make_story(title='Istanbul Story', location_name='Istanbul')
        make_story(title='Ankara Story', location_name='Ankara')
        qs = get_story_feed(location='Istanbul')
        assert qs.count() == 1
        assert qs.first().title == 'Istanbul Story'

    def test_filters_by_location_name_case_insensitive(self):
        make_story(location_name='Galata Bridge')
        assert get_story_feed(location='galata').count() == 1
        assert get_story_feed(location='GALATA').count() == 1

    def test_filters_by_location_name_partial_match(self):
        make_story(location_name='Galata Bridge')
        assert get_story_feed(location='Bridge').count() == 1

    def test_location_filter_excludes_non_matching(self):
        make_story(location_name='Galata Bridge')
        assert get_story_feed(location='Bosphorus').count() == 0

    def test_combined_year_and_location_filter(self):
        make_story(title='Match', year=1950, location_name='Istanbul')
        make_story(title='Wrong Year', year=1900, location_name='Istanbul')
        make_story(title='Wrong Location', year=1950, location_name='Ankara')
        qs = get_story_feed(year_from=1940, location='Istanbul')
        assert qs.count() == 1
        assert qs.first().title == 'Match'
