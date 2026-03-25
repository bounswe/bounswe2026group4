from decimal import Decimal

import pytest

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.stories.models import Story
from apps.tags.models import StoryTag, Tag
from apps.users.models import User


def _make_story(user, title='T'):
    return Story.objects.create(
        user=user, title=title, narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='P', time_type=Story.TIME_EXACT, year=2000,
    )


@pytest.mark.django_db
class TestTag:
    def test_tag_can_be_created(self):
        tag = Tag.objects.create(name='history')
        assert tag.pk is not None

    def test_is_predefined_defaults_to_false(self):
        tag = Tag.objects.create(name='history')
        assert tag.is_predefined is False

    def test_story_count_defaults_to_zero(self):
        tag = Tag.objects.create(name='history')
        assert tag.story_count == 0

    def test_str_returns_name(self):
        tag = Tag.objects.create(name='history')
        assert str(tag) == 'history'

    def test_tag_name_must_be_unique(self):
        Tag.objects.create(name='history')
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Tag.objects.create(name='history')

    # ── Format validation (req. 1.3.6.4) ─────────────────────────────────────

    def test_valid_single_lowercase_word(self):
        Tag(name='history').full_clean()  # must not raise

    def test_valid_hyphen_separated_words(self):
        Tag(name='ottoman-era').full_clean()  # must not raise

    def test_valid_name_with_digits(self):
        Tag(name='19th-century').full_clean()  # must not raise

    def test_valid_digits_only(self):
        Tag(name='1453').full_clean()  # must not raise

    def test_invalid_uppercase_raises(self):
        with pytest.raises(ValidationError):
            Tag(name='Ottoman').full_clean()

    def test_invalid_spaces_raises(self):
        with pytest.raises(ValidationError):
            Tag(name='ottoman era').full_clean()

    def test_invalid_leading_hyphen_raises(self):
        with pytest.raises(ValidationError):
            Tag(name='-ottoman').full_clean()

    def test_invalid_trailing_hyphen_raises(self):
        with pytest.raises(ValidationError):
            Tag(name='ottoman-').full_clean()

    def test_invalid_double_hyphen_raises(self):
        with pytest.raises(ValidationError):
            Tag(name='otto--man').full_clean()

    def test_invalid_special_characters_raise(self):
        with pytest.raises(ValidationError):
            Tag(name='ottoman@era').full_clean()


@pytest.mark.django_db
class TestStoryTag:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='tagger@example.com', username='tagger', password='Password1',
        )
        self.story = _make_story(self.user)
        self.tag = Tag.objects.create(name='test-tag')

    def test_story_tag_can_be_created(self):
        st = StoryTag.objects.create(story=self.story, tag=self.tag)
        assert st.pk is not None

    def test_duplicate_story_tag_raises_integrity_error(self):
        StoryTag.objects.create(story=self.story, tag=self.tag)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                StoryTag.objects.create(story=self.story, tag=self.tag)

    def test_same_tag_on_different_stories_is_allowed(self, story):
        st1 = StoryTag.objects.create(story=self.story, tag=self.tag)
        st2 = StoryTag.objects.create(story=story, tag=self.tag)
        assert st1.pk != st2.pk

    def test_different_tags_on_same_story_is_allowed(self):
        tag2 = Tag.objects.create(name='second-tag')
        st1 = StoryTag.objects.create(story=self.story, tag=self.tag)
        st2 = StoryTag.objects.create(story=self.story, tag=tag2)
        assert st1.pk != st2.pk

    def test_cascade_deletes_when_story_is_deleted(self):
        st = StoryTag.objects.create(story=self.story, tag=self.tag)
        st_pk = st.pk
        self.story.delete()
        assert not StoryTag.objects.filter(pk=st_pk).exists()

    def test_cascade_deletes_when_tag_is_deleted(self):
        st = StoryTag.objects.create(story=self.story, tag=self.tag)
        st_pk = st.pk
        self.tag.delete()
        assert not StoryTag.objects.filter(pk=st_pk).exists()

    def test_story_can_hold_three_tags(self):
        # Max-3 is an application-layer rule enforced in the serializer, not the DB.
        # Verify the DB itself accepts 3 tags on one story.
        tag2 = Tag.objects.create(name='tag-two')
        tag3 = Tag.objects.create(name='tag-three')
        StoryTag.objects.create(story=self.story, tag=self.tag)
        StoryTag.objects.create(story=self.story, tag=tag2)
        StoryTag.objects.create(story=self.story, tag=tag3)
        assert StoryTag.objects.filter(story=self.story).count() == 3
