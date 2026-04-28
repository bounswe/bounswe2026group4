from decimal import Decimal

import pytest

from apps.media.models import MediaItem, MediaType
from apps.stories.models import Story
from apps.stories.services import annotate_user_interactions, create_story, delete_story, get_story_feed, get_story_search, get_story_timeline, update_story
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
        
    def test_sorts_by_most_popular(self):
        # Create three stories with different like_count values. We expect the queryset
        # to be ordered by like_count DESC when sort_by='popular'.
        s1 = make_story(title='Least Popular', like_count=5)
        s2 = make_story(title='Medium Popular', like_count=10)
        s3 = make_story(title='Most Popular', like_count=20)
        results = list(get_story_feed(sort_by='popular'))
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


# ── create_story / update_story with tags ────────────────────────────────────

@pytest.mark.django_db
class TestCreateStoryWithTags:
    def test_create_story_with_tag_ids_attaches_tags(self, user):
        tag = Tag.objects.create(name='svc-story-tag-a')
        story = create_story(user=user, validated_data={**make_story_data(), 'tag_ids': [tag.pk]})
        assert StoryTag.objects.filter(story=story, tag=tag).exists()

    def test_create_story_with_tag_ids_increments_story_count(self, user):
        tag = Tag.objects.create(name='svc-story-tag-b')
        create_story(user=user, validated_data={**make_story_data(), 'tag_ids': [tag.pk]})
        tag.refresh_from_db()
        assert tag.story_count == 1

    def test_create_story_without_tag_ids_creates_no_story_tags(self, user):
        story = create_story(user=user, validated_data=make_story_data())
        assert StoryTag.objects.filter(story=story).count() == 0

    def test_create_story_with_empty_tag_ids_creates_no_story_tags(self, user):
        story = create_story(user=user, validated_data={**make_story_data(), 'tag_ids': []})
        assert StoryTag.objects.filter(story=story).count() == 0


@pytest.mark.django_db
class TestUpdateStoryWithTags:
    def test_update_story_syncs_tags_when_provided(self, story):
        tag_old = Tag.objects.create(name='svc-upd-old')
        tag_new = Tag.objects.create(name='svc-upd-new')
        StoryTag.objects.create(story=story, tag=tag_old)
        update_story(story=story, validated_data={'tag_ids': [tag_new.pk]})
        assert not StoryTag.objects.filter(story=story, tag=tag_old).exists()
        assert StoryTag.objects.filter(story=story, tag=tag_new).exists()

    def test_update_story_leaves_tags_when_tag_ids_not_provided(self, story):
        tag = Tag.objects.create(name='svc-upd-keep')
        StoryTag.objects.create(story=story, tag=tag)
        update_story(story=story, validated_data={'title': 'New Title'})
        assert StoryTag.objects.filter(story=story, tag=tag).exists()

    def test_update_story_removes_all_tags_when_empty_list_provided(self, story):
        tag = Tag.objects.create(name='svc-upd-clear')
        StoryTag.objects.create(story=story, tag=tag)
        update_story(story=story, validated_data={'tag_ids': []})
        assert StoryTag.objects.filter(story=story).count() == 0

    def test_update_story_decrements_story_count_for_removed_tags(self, story):
        # story_count starts at 0; signal increments to 1 on StoryTag creation
        tag = Tag.objects.create(name='svc-upd-dec')
        StoryTag.objects.create(story=story, tag=tag)
        update_story(story=story, validated_data={'tag_ids': []})
        tag.refresh_from_db()
        assert tag.story_count == 0


# ── Geo radius filter helpers ─────────────────────────────────────────────────

# Center point: Istanbul, Galata Tower area
CENTER_LAT = 41.025580
CENTER_LNG = 28.974180

# Precomputed coordinate offsets (moving north along the same longitude):
#   ~0.5 km north  → lat + 0.004493  (well within 1 km)
#   ~3.0 km north  → lat + 0.026958  (inside 5 km, outside 1 km)
#   ~50 km north   → lat + 0.449246  (outside any test radius)
NEAR_LAT  = 41.030073   # ~0.5 km from center
NEAR_LNG  = CENTER_LNG

MID_LAT   = 41.052538   # ~3 km from center
MID_LNG   = CENTER_LNG

FAR_LAT   = 41.474826   # ~50 km from center
FAR_LNG   = CENTER_LNG


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


# ── get_story_feed geo filtering ──────────────────────────────────────────────

@pytest.mark.django_db
class TestGetStoryFeedGeoFilter:
    def test_returns_story_within_radius(self):
        near = make_geo_story(NEAR_LAT, NEAR_LNG)
        qs = get_story_feed(latitude=CENTER_LAT, longitude=CENTER_LNG, radius_km=1.0)
        assert near in qs

    def test_excludes_story_outside_radius(self):
        far = make_geo_story(FAR_LAT, FAR_LNG)
        qs = get_story_feed(latitude=CENTER_LAT, longitude=CENTER_LNG, radius_km=1.0)
        assert far not in qs

    def test_larger_radius_includes_more_stories(self):
        make_geo_story(NEAR_LAT, NEAR_LNG, title='Near')
        make_geo_story(MID_LAT, MID_LNG, title='Mid')
        make_geo_story(FAR_LAT, FAR_LNG, title='Far')
        qs_1km = get_story_feed(latitude=CENTER_LAT, longitude=CENTER_LNG, radius_km=1.0)
        qs_5km = get_story_feed(latitude=CENTER_LAT, longitude=CENTER_LNG, radius_km=5.0)
        assert qs_5km.count() > qs_1km.count()

    def test_omitting_geo_params_returns_all_stories(self):
        make_geo_story(NEAR_LAT, NEAR_LNG)
        make_geo_story(FAR_LAT, FAR_LNG)
        qs = get_story_feed()
        assert qs.count() == 2

    def test_geo_filter_combined_with_year_filter(self):
        near_old = make_geo_story(NEAR_LAT, NEAR_LNG, year=1900, title='NearOld')
        near_new = make_geo_story(NEAR_LAT, NEAR_LNG, year=2000, title='NearNew')
        qs = get_story_feed(latitude=CENTER_LAT, longitude=CENTER_LNG, radius_km=1.0, year_from=1950)
        assert near_new in qs
        assert near_old not in qs

    def test_geo_filter_combined_with_tag_filter(self):
        tag = Tag.objects.create(name='geo-svc-tag')
        near_tagged = make_geo_story(NEAR_LAT, NEAR_LNG, title='NearTagged')
        StoryTag.objects.create(story=near_tagged, tag=tag)
        near_untagged = make_geo_story(NEAR_LAT, NEAR_LNG, title='NearUntagged')
        qs = get_story_feed(latitude=CENTER_LAT, longitude=CENTER_LNG, radius_km=1.0, tag='geo-svc-tag')
        assert near_tagged in qs
        assert near_untagged not in qs

    def test_geo_filter_result_is_queryset_compatible_with_annotate(self):
        user = User.objects.create_user(email='geo@example.com', username='geouser', password='Password1')
        make_geo_story(NEAR_LAT, NEAR_LNG)
        qs = get_story_feed(latitude=CENTER_LAT, longitude=CENTER_LNG, radius_km=1.0)
        annotated = annotate_user_interactions(qs, user)
        stories = list(annotated)
        assert len(stories) > 0
        assert hasattr(stories[0], '_user_has_liked')
        assert hasattr(stories[0], '_user_has_saved')

    def test_geo_filter_preserves_sort_by_popular_ordering(self):
        popular = make_geo_story(NEAR_LAT, NEAR_LNG, title='Popular', like_count=10)
        unpopular = make_geo_story(NEAR_LAT, NEAR_LNG, title='Unpopular', like_count=0)
        qs = list(get_story_feed(latitude=CENTER_LAT, longitude=CENTER_LNG, radius_km=1.0, sort_by='popular'))
        assert qs[0].pk == popular.pk
        assert qs[1].pk == unpopular.pk

    def test_geo_filter_returns_empty_when_no_stories_within_radius(self):
        make_geo_story(FAR_LAT, FAR_LNG)
        qs = get_story_feed(latitude=CENTER_LAT, longitude=CENTER_LNG, radius_km=1.0)
        assert qs.count() == 0

    def test_geo_filter_excludes_draft_stories_within_radius(self):
        make_geo_story(NEAR_LAT, NEAR_LNG, status=Story.STATUS_DRAFT)
        qs = get_story_feed(latitude=CENTER_LAT, longitude=CENTER_LNG, radius_km=1.0)
        assert qs.count() == 0


# ── get_story_search geo filtering ───────────────────────────────────────────

@pytest.mark.django_db
class TestGetStorySearchGeoFilter:
    def test_returns_matching_story_within_radius(self):
        near = make_geo_story(NEAR_LAT, NEAR_LNG, title='Ancient Tower')
        qs = get_story_search('Ancient', latitude=CENTER_LAT, longitude=CENTER_LNG, radius_km=1.0)
        assert near in qs

    def test_excludes_matching_story_outside_radius(self):
        far = make_geo_story(FAR_LAT, FAR_LNG, title='Ancient Tower')
        qs = get_story_search('Ancient', latitude=CENTER_LAT, longitude=CENTER_LNG, radius_km=1.0)
        assert far not in qs

    def test_geo_filter_does_not_include_non_matching_nearby_story(self):
        make_geo_story(NEAR_LAT, NEAR_LNG, title='Unrelated Story')
        qs = get_story_search('Ancient', latitude=CENTER_LAT, longitude=CENTER_LNG, radius_km=1.0)
        assert qs.count() == 0

    def test_omitting_geo_params_returns_all_matching_stories(self):
        make_geo_story(NEAR_LAT, NEAR_LNG, title='Ancient Near')
        make_geo_story(FAR_LAT, FAR_LNG, title='Ancient Far')
        qs = get_story_search('Ancient')
        assert qs.count() == 2

    def test_geo_filter_result_is_queryset_compatible_with_annotate(self):
        user = User.objects.create_user(email='geosearch@example.com', username='geosearch', password='Password1')
        make_geo_story(NEAR_LAT, NEAR_LNG, title='Ancient Tower')
        qs = get_story_search('Ancient', latitude=CENTER_LAT, longitude=CENTER_LNG, radius_km=1.0)
        annotated = annotate_user_interactions(qs, user)
        stories = list(annotated)
        assert len(stories) > 0
        assert hasattr(stories[0], '_user_has_liked')
        assert hasattr(stories[0], '_user_has_saved')


# ── get_story_timeline ────────────────────────────────────────────────────────

# Bounding box centred on Istanbul — used across several bbox tests
_BBOX_ISTANBUL = dict(lat_min=40.9, lat_max=41.2, lng_min=28.7, lng_max=29.2)


def make_timeline_media_item(story, media_type=MediaType.IMAGE, order=0):
    return MediaItem.objects.create(
        story=story,
        media_type=media_type,
        file_size=1024,
        original_filename='photo.jpg',
        order=order,
        file='stories/2024/01/photo.jpg',
    )


@pytest.mark.django_db
class TestGetStoryTimeline:
    def test_returns_only_published_stories(self):
        make_story(status=Story.STATUS_PUBLISHED, year=1900)
        make_story(status=Story.STATUS_DRAFT, title='Draft Story', year=1910)
        make_story(status=Story.STATUS_REMOVED, title='Removed Story', year=1920)
        qs = get_story_timeline()
        assert qs.count() == 1
        assert qs.first().status == Story.STATUS_PUBLISHED

    def test_excludes_removed_stories(self):
        make_story(status=Story.STATUS_REMOVED, year=1900)
        assert get_story_timeline().count() == 0

    def test_default_order_is_ascending_by_historical_year(self):
        s1 = make_story(title='Oldest', year=1800)
        s2 = make_story(title='Middle', year=1900)
        s3 = make_story(title='Newest', year=2000)
        results = list(get_story_timeline())
        assert results[0].id == s1.id
        assert results[1].id == s2.id
        assert results[2].id == s3.id

    def test_decade_story_sorts_by_midpoint_year_plus_five(self):
        # 1980s midpoint = 1985; exact 1992 falls between 1985 and 1995
        s_80s = make_story(title='1980s', time_type=Story.TIME_DECADE, year=1980)
        s_exact = make_story(title='Exact 1992', year=1992)
        s_90s = make_story(title='1990s', time_type=Story.TIME_DECADE, year=1990)
        results = list(get_story_timeline())
        assert results[0].id == s_80s.id    # midpoint 1985
        assert results[1].id == s_exact.id  # 1992
        assert results[2].id == s_90s.id    # midpoint 1995

    def test_year_range_story_sorts_by_midpoint(self):
        # 1840–1880 midpoint = 1860; exact 1870 should sort after it
        s_range = make_story(
            title='Range 1840-1880',
            time_type=Story.TIME_RANGE,
            year=None,
            year_start=1840,
            year_end=1880,
        )
        s_exact = make_story(title='Exact 1870', year=1870)
        results = list(get_story_timeline())
        assert results[0].id == s_range.id
        assert results[1].id == s_exact.id

    def test_year_from_filter_excludes_older_exact_stories(self):
        make_story(title='Before', year=1800)
        s = make_story(title='After', year=1900)
        qs = get_story_timeline(year_from=1850)
        assert qs.count() == 1
        assert qs.first().id == s.id

    def test_year_to_filter_excludes_newer_exact_stories(self):
        s = make_story(title='Before', year=1800)
        make_story(title='After', year=1900)
        qs = get_story_timeline(year_to=1850)
        assert qs.count() == 1
        assert qs.first().id == s.id

    def test_year_from_and_year_to_combined(self):
        make_story(title='Too Old', year=1700)
        s = make_story(title='In Range', year=1800)
        make_story(title='Too New', year=1900)
        qs = get_story_timeline(year_from=1750, year_to=1850)
        assert qs.count() == 1
        assert qs.first().id == s.id

    def test_decade_included_when_interval_overlaps_year_from(self):
        # 1980s spans 1980–1989; year_from=1985 must include it (overlap)
        s = make_story(title='1980s', time_type=Story.TIME_DECADE, year=1980)
        qs = get_story_timeline(year_from=1985)
        assert qs.count() == 1
        assert qs.first().id == s.id

    def test_decade_excluded_when_interval_ends_before_year_from(self):
        # 1980s spans 1980–1989; year_from=1990 must exclude it (no overlap)
        make_story(title='1980s', time_type=Story.TIME_DECADE, year=1980)
        assert get_story_timeline(year_from=1990).count() == 0

    def test_year_range_included_when_interval_overlaps_year_from(self):
        s = make_story(
            title='Overlapping Range',
            time_type=Story.TIME_RANGE,
            year=None,
            year_start=1840,
            year_end=1870,
        )
        qs = get_story_timeline(year_from=1860)
        assert qs.count() == 1
        assert qs.first().id == s.id

    def test_year_range_included_when_interval_overlaps_year_to(self):
        s = make_story(
            title='Overlapping Range',
            time_type=Story.TIME_RANGE,
            year=None,
            year_start=1840,
            year_end=1870,
        )
        qs = get_story_timeline(year_to=1850)
        assert qs.count() == 1
        assert qs.first().id == s.id

    def test_bbox_filter_includes_story_inside_box(self):
        s = make_story(title='Inside', location_lat='41.0', location_lng='28.9', year=1900)
        qs = get_story_timeline(**_BBOX_ISTANBUL)
        assert qs.count() == 1
        assert qs.first().id == s.id

    def test_bbox_filter_excludes_story_outside_box(self):
        make_story(title='Outside', location_lat='39.9', location_lng='32.8', year=1900)
        assert get_story_timeline(**_BBOX_ISTANBUL).count() == 0

    def test_bbox_and_year_from_combined(self):
        make_story(title='Too Old', location_lat='41.0', location_lng='28.9', year=1800)
        s = make_story(title='Match', location_lat='41.0', location_lng='28.9', year=1900)
        make_story(title='Outside', location_lat='39.9', location_lng='32.8', year=1900)
        qs = get_story_timeline(year_from=1850, **_BBOX_ISTANBUL)
        assert qs.count() == 1
        assert qs.first().id == s.id

    def test_has_image_true_returns_only_stories_with_image_media(self):
        s_with = make_story(title='With Image', year=1900)
        make_timeline_media_item(s_with, media_type=MediaType.IMAGE)
        make_story(title='No Image', year=1910)
        qs = get_story_timeline(has_image=True)
        assert qs.count() == 1
        assert qs.first().id == s_with.id

    def test_has_image_none_returns_all_stories(self):
        s1 = make_story(title='With Image', year=1900)
        make_timeline_media_item(s1, media_type=MediaType.IMAGE)
        make_story(title='No Image', year=1910)
        assert get_story_timeline(has_image=None).count() == 2
