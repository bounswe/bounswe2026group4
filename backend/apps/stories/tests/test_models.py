from decimal import Decimal

import pytest

from django.core.exceptions import ValidationError

from apps.stories.models import PeriodType, Story, StoryStatus
from apps.users.models import User


def _make_story(user, **kwargs):
    """Helper: create a minimal valid Story. Override only what you need."""
    defaults = dict(
        author=user,
        title='Test Story',
        narrative_text='Some narrative.',
        latitude=Decimal('41.015137'),
        longitude=Decimal('28.979530'),
        place_name='Istanbul',
        period_type=PeriodType.EXACT,
        start_year=1453,
    )
    defaults.update(kwargs)
    return Story.objects.create(**defaults)


@pytest.mark.django_db
class TestStoryDefaults:
    def test_status_defaults_to_draft(self, user):
        s = _make_story(user)
        assert s.status == StoryStatus.DRAFT

    def test_like_count_defaults_to_zero(self, user):
        s = _make_story(user)
        assert s.like_count == 0

    def test_save_count_defaults_to_zero(self, user):
        s = _make_story(user)
        assert s.save_count == 0

    def test_removal_reason_defaults_to_blank(self, user):
        s = _make_story(user)
        assert s.removal_reason == ''

    def test_region_defaults_to_blank(self, user):
        s = _make_story(user)
        assert s.region == ''

    def test_created_at_is_set_on_insert(self, user):
        s = _make_story(user)
        assert s.created_at is not None

    def test_updated_at_changes_on_save(self, user):
        s = _make_story(user)
        original = s.updated_at
        s.title = 'Updated'
        s.save()
        s.refresh_from_db()
        assert s.updated_at >= original

    def test_str_returns_title(self, user):
        s = _make_story(user, title='My Story Title')
        assert str(s) == 'My Story Title'


@pytest.mark.django_db
class TestStoryAuthorNullability:
    """Verifies SET_NULL anonymisation behaviour (req. 1.1.2.11)."""

    def test_story_row_survives_author_deletion(self, story, user):
        story_pk = story.pk
        user.delete()
        assert Story.objects.filter(pk=story_pk).exists()

    def test_author_becomes_null_when_user_is_deleted(self, story, user):
        story_pk = story.pk
        user.delete()
        refreshed = Story.objects.get(pk=story_pk)
        assert refreshed.author is None

    def test_story_can_be_created_without_author(self):
        s = Story.objects.create(
            author=None,
            title='Anon Story',
            narrative_text='Narrative.',
            latitude=Decimal('0'),
            longitude=Decimal('0'),
            place_name='Somewhere',
            period_type=PeriodType.EXACT,
            start_year=2000,
        )
        assert s.author is None


@pytest.mark.django_db
class TestStoryPeriodTypeValidation:
    """Tests model-level clean() validation — does NOT require a DB round-trip."""

    def setup_method(self):
        self.base = dict(
            title='T', narrative_text='N',
            latitude=Decimal('0'), longitude=Decimal('0'),
            place_name='P',
        )

    def test_exact_period_with_only_start_year_passes(self, user):
        s = Story(author=user, period_type=PeriodType.EXACT, start_year=1900, **self.base)
        s.full_clean()  # must not raise

    def test_range_period_with_end_year_passes(self, user):
        s = Story(author=user, period_type=PeriodType.RANGE,
                  start_year=1900, end_year=1950, **self.base)
        s.full_clean()  # must not raise

    def test_range_period_without_end_year_raises(self, user):
        s = Story(author=user, period_type=PeriodType.RANGE,
                  start_year=1900, end_year=None, **self.base)
        with pytest.raises(ValidationError) as exc:
            s.full_clean()
        assert 'end_year' in exc.value.message_dict

    def test_decade_period_with_decade_field_passes(self, user):
        s = Story(author=user, period_type=PeriodType.DECADE,
                  start_year=1920, decade=1920, **self.base)
        s.full_clean()  # must not raise

    def test_decade_period_without_decade_field_raises(self, user):
        s = Story(author=user, period_type=PeriodType.DECADE,
                  start_year=1920, decade=None, **self.base)
        with pytest.raises(ValidationError) as exc:
            s.full_clean()
        assert 'decade' in exc.value.message_dict

    def test_exact_period_null_end_year_passes(self, user):
        # NULL end_year on EXACT is the normal state — must not raise
        s = Story(author=user, period_type=PeriodType.EXACT,
                  start_year=1453, end_year=None, decade=None, **self.base)
        s.full_clean()  # must not raise

    def test_plain_save_bypasses_full_clean(self, user):
        # Django .save() does NOT call full_clean(). Validation must be enforced
        # at the serializer/service layer; this test documents that known gap.
        s = Story.objects.create(
            author=user, period_type=PeriodType.RANGE,
            start_year=1900, end_year=None, **self.base,
        )
        assert s.pk is not None  # DB accepted it — expected/documented


@pytest.mark.django_db
class TestStoryCoordinatePrecision:
    def test_decimal_coordinates_round_trip_accurately(self, user):
        s = _make_story(user,
                        latitude=Decimal('41.123456'),
                        longitude=Decimal('28.987654'))
        s.refresh_from_db()
        assert s.latitude == Decimal('41.123456')
        assert s.longitude == Decimal('28.987654')

    def test_negative_latitude_stored_correctly(self, user):
        s = _make_story(user, latitude=Decimal('-33.868820'))
        s.refresh_from_db()
        assert s.latitude == Decimal('-33.868820')

    def test_boundary_latitude_values_are_accepted(self, user):
        for lat in [Decimal('-90.000000'), Decimal('90.000000')]:
            s = _make_story(user, latitude=lat)
            s.refresh_from_db()
            assert s.latitude == lat


@pytest.mark.django_db
class TestStoryStatusTransitions:
    def test_story_can_be_published(self, user):
        s = _make_story(user)
        s.status = StoryStatus.PUBLISHED
        s.save()
        s.refresh_from_db()
        assert s.status == StoryStatus.PUBLISHED

    def test_story_can_be_removed_with_reason(self, user):
        s = _make_story(user)
        s.status = StoryStatus.REMOVED
        s.removal_reason = 'Violated community guidelines.'
        s.save()
        s.refresh_from_db()
        assert s.status == StoryStatus.REMOVED
        assert s.removal_reason == 'Violated community guidelines.'
