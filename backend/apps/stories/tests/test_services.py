from decimal import Decimal

import pytest

from apps.stories.models import Story
from apps.stories.services import create_story, delete_story, get_story_feed, get_story_search, update_story
from apps.tags.models import StoryTag, Tag
from apps.users.models import User


# ── Helpers ───────────────────────────────────────────────────────────────────

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


# ── get_story_feed ────────────────────────────────────────────────────────────

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


# ── create_story / update_story ───────────────────────────────────────────────

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


# ── get_story_search ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestGetStorySearch:
    def test_get_story_search_matches_title(self):
        make_story(title='The Old Bridge')
        assert get_story_search('Old Bridge').count() == 1

    def test_get_story_search_matches_location_name(self):
        make_story(location_name='Galata Bridge')
        assert get_story_search('Galata').count() == 1

    def test_get_story_search_is_case_insensitive(self):
        make_story(title='Istanbul Tales')
        assert get_story_search('istanbul').count() == 1
        assert get_story_search('ISTANBUL').count() == 1

    def test_get_story_search_with_empty_query_returns_empty(self):
        make_story(title='Some Story')
        assert get_story_search('').count() == 0

    def test_get_story_search_with_whitespace_only_query_returns_empty(self):
        make_story(title='Some Story')
        assert get_story_search('   ').count() == 0

    def test_get_story_search_excludes_removed_stories(self):
        make_story(title='Gone Story', status=Story.STATUS_REMOVED)
        assert get_story_search('Gone').count() == 0

    def test_get_story_search_excludes_draft_stories(self):
        make_story(title='Draft Story', status=Story.STATUS_DRAFT)
        assert get_story_search('Draft').count() == 0

    def test_get_story_search_returns_no_results_when_no_match(self):
        make_story(title='Istanbul Tales')
        assert get_story_search('Bosphorus').count() == 0

    def test_get_story_search_returns_multiple_matches(self):
        make_story(title='Istanbul in 1900')
        make_story(title='Istanbul Today')
        assert get_story_search('Istanbul').count() == 2

    def test_get_story_search_filters_by_year_from(self):
        make_story(title='Old Istanbul', year=1800)
        make_story(title='New Istanbul', year=1950)
        assert get_story_search('Istanbul', year_from=1900).count() == 1
        assert get_story_search('Istanbul', year_from=1900).first().title == 'New Istanbul'

    def test_get_story_search_filters_by_year_to(self):
        make_story(title='Old Istanbul', year=1800)
        make_story(title='New Istanbul', year=1950)
        assert get_story_search('Istanbul', year_to=1900).count() == 1
        assert get_story_search('Istanbul', year_to=1900).first().title == 'Old Istanbul'

    def test_get_story_search_filters_by_year_from_and_year_to(self):
        make_story(title='Istanbul 1700', year=1700)
        make_story(title='Istanbul 1850', year=1850)
        make_story(title='Istanbul 2000', year=2000)
        qs = get_story_search('Istanbul', year_from=1800, year_to=1900)
        assert qs.count() == 1
        assert qs.first().title == 'Istanbul 1850'

    def test_get_story_search_filters_by_location(self):
        make_story(title='Bridge Story', location_name='Galata Bridge')
        make_story(title='Tower Story', location_name='Galata Tower')
        make_story(title='Ankara Story', location_name='Ankara Castle')
        qs = get_story_search('Story', location='Galata')
        assert qs.count() == 2

    def test_get_story_search_excludes_non_matching_location(self):
        make_story(title='Istanbul Story', location_name='Galata Bridge')
        assert get_story_search('Istanbul', location='Ankara').count() == 0

    def test_get_story_search_combined_text_year_and_location(self):
        make_story(title='Tower in Galata', year=1900, location_name='Galata')
        make_story(title='Tower in Ankara', year=1900, location_name='Ankara')
        make_story(title='Tower too late', year=2000, location_name='Galata')
        qs = get_story_search('Tower', year_from=1800, year_to=1950, location='Galata')
        assert qs.count() == 1
        assert qs.first().title == 'Tower in Galata'


# ── get_story_feed — tag filter ───────────────────────────────────────────────

@pytest.mark.django_db
class TestGetStoryFeedTagFilter:
    def test_feed_tag_filter_returns_matching_stories(self):
        tagged = make_story(title='Tagged Story')
        make_story(title='Untagged Story')
        tag = Tag.objects.create(name='folklore')
        StoryTag.objects.create(story=tagged, tag=tag)
        qs = get_story_feed(tag='folklore')
        assert qs.count() == 1
        assert qs.first().title == 'Tagged Story'

    def test_feed_tag_filter_excludes_non_matching_stories(self):
        story = make_story()
        tag = Tag.objects.create(name='ottoman-era')
        StoryTag.objects.create(story=story, tag=tag)
        assert get_story_feed(tag='folklore').count() == 0

    def test_feed_tag_filter_is_case_insensitive(self):
        story = make_story()
        tag = Tag.objects.create(name='ottoman-era')
        StoryTag.objects.create(story=story, tag=tag)
        assert get_story_feed(tag='Ottoman-Era').count() == 1
        assert get_story_feed(tag='OTTOMAN-ERA').count() == 1

    def test_feed_tag_filter_combined_with_year_filter(self):
        match = make_story(title='Match', year=1950)
        no_match = make_story(title='Too Early', year=1800)
        tag = Tag.objects.create(name='folklore')
        StoryTag.objects.create(story=match, tag=tag)
        StoryTag.objects.create(story=no_match, tag=tag)
        qs = get_story_feed(tag='folklore', year_from=1900)
        assert qs.count() == 1
        assert qs.first().title == 'Match'

    def test_feed_tag_filter_combined_with_location_filter(self):
        match = make_story(title='Match', location_name='Istanbul')
        no_match = make_story(title='Wrong Location', location_name='Ankara')
        tag = Tag.objects.create(name='folklore')
        StoryTag.objects.create(story=match, tag=tag)
        StoryTag.objects.create(story=no_match, tag=tag)
        qs = get_story_feed(tag='folklore', location='Istanbul')
        assert qs.count() == 1
        assert qs.first().title == 'Match'

    def test_feed_tag_filter_does_not_return_duplicates(self):
        story = make_story()
        tag1 = Tag.objects.create(name='folklore')
        tag2 = Tag.objects.create(name='ottoman-era')
        StoryTag.objects.create(story=story, tag=tag1)
        StoryTag.objects.create(story=story, tag=tag2)
        # Filtering by one tag on a story that has multiple tags must not produce duplicates
        assert get_story_feed(tag='folklore').count() == 1


# ── get_story_search — tag filter ────────────────────────────────────────────

@pytest.mark.django_db
class TestGetStorySearchTagFilter:
    def test_search_tag_param_narrows_results(self):
        tagged = make_story(title='Istanbul Tale')
        make_story(title='Istanbul Lore')
        tag = Tag.objects.create(name='folklore')
        StoryTag.objects.create(story=tagged, tag=tag)
        qs = get_story_search('Istanbul', tag='folklore')
        assert qs.count() == 1
        assert qs.first().title == 'Istanbul Tale'

    def test_search_tag_param_excludes_untagged(self):
        make_story(title='Istanbul Tale')
        assert get_story_search('Istanbul', tag='folklore').count() == 0

    def test_search_tag_and_q_both_must_match(self):
        # Story matches tag but neither title nor location_name matches q — should not appear
        tagged = make_story(title='Ankara Chronicle', location_name='Ankara')
        tag = Tag.objects.create(name='folklore')
        StoryTag.objects.create(story=tagged, tag=tag)
        assert get_story_search('Istanbul', tag='folklore').count() == 0


# ── delete_story ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDeleteStory:
    def test_delete_removes_story_from_db(self, story):
        pk = story.pk
        delete_story(story)
        assert not Story.objects.filter(pk=pk).exists()

    def test_delete_returns_none(self, story):
        result = delete_story(story)
        assert result is None

