import pytest
from decimal import Decimal

from apps.tags.models import Tag, StoryTag
from apps.tags.services import (
    attach_tags_to_story,
    create_tag,
    delete_tag,
    list_tags,
    normalize_tag_name,
    sync_story_tags,
)


class TestNormalizeTagName:
    def test_lowercase(self):
        assert normalize_tag_name('Ottoman') == 'ottoman'

    def test_spaces_to_hyphens(self):
        assert normalize_tag_name('daily life') == 'daily-life'

    def test_underscores_to_hyphens(self):
        assert normalize_tag_name('daily_life') == 'daily-life'

    def test_strips_special_characters(self):
        assert normalize_tag_name('ottoman@era!') == 'ottomanera'

    def test_collapses_consecutive_hyphens(self):
        assert normalize_tag_name('otto--man') == 'otto-man'

    def test_strips_leading_and_trailing_hyphens(self):
        assert normalize_tag_name('-history-') == 'history'

    def test_mixed_input(self):
        assert normalize_tag_name('  Ottoman ERA  ') == 'ottoman-era'


@pytest.mark.django_db
class TestListTags:
    def test_returns_created_tags(self):
        Tag.objects.create(name='svc-test-alpha')
        Tag.objects.create(name='svc-test-beta')
        names = list(list_tags().values_list('name', flat=True))
        assert 'svc-test-alpha' in names
        assert 'svc-test-beta' in names

    def test_filters_predefined_true(self):
        Tag.objects.create(name='svc-predefined-tag', is_predefined=True)
        Tag.objects.create(name='svc-user-tag', is_predefined=False)
        result = list(list_tags(is_predefined=True).values_list('name', flat=True))
        assert 'svc-predefined-tag' in result
        assert 'svc-user-tag' not in result

    def test_filters_predefined_false(self):
        Tag.objects.create(name='svc-predefined-tag2', is_predefined=True)
        Tag.objects.create(name='svc-user-tag2', is_predefined=False)
        result = list(list_tags(is_predefined=False).values_list('name', flat=True))
        assert 'svc-user-tag2' in result
        assert 'svc-predefined-tag2' not in result

    def test_filters_by_q(self):
        Tag.objects.create(name='svc-unique-qtest-era')
        Tag.objects.create(name='svc-unique-other')
        result = list(list_tags(q='qtest').values_list('name', flat=True))
        assert result == ['svc-unique-qtest-era']

    def test_combined_filter_predefined_and_q(self):
        Tag.objects.create(name='svc-combo-user', is_predefined=False)
        Tag.objects.create(name='svc-combo-admin', is_predefined=True)
        result = list(list_tags(is_predefined=False, q='svc-combo').values_list('name', flat=True))
        assert result == ['svc-combo-user']

    def test_ordered_by_story_count_desc_then_name(self):
        Tag.objects.create(name='svc-ord-zebra', story_count=5)
        Tag.objects.create(name='svc-ord-alpha', story_count=10)
        Tag.objects.create(name='svc-ord-beta', story_count=5)
        names = list(list_tags(q='svc-ord').values_list('name', flat=True))
        assert names == ['svc-ord-alpha', 'svc-ord-beta', 'svc-ord-zebra']

    def test_q_is_case_insensitive(self):
        Tag.objects.create(name='svc-case-ottoman')
        result = list_tags(q='SVC-CASE')
        assert result.count() == 1


@pytest.mark.django_db
class TestCreateTag:
    def test_creates_new_tag(self):
        tag, created = create_tag({'name': 'svc-brand-new'})
        assert created is True
        assert tag.name == 'svc-brand-new'
        assert Tag.objects.filter(name='svc-brand-new').exists()

    def test_duplicate_returns_existing_tag(self):
        Tag.objects.create(name='svc-existing')
        tag, created = create_tag({'name': 'svc-existing'})
        assert created is False
        assert tag.name == 'svc-existing'
        assert Tag.objects.filter(name='svc-existing').count() == 1

    def test_normalizes_name_before_lookup(self):
        Tag.objects.create(name='svc-norm-era')
        tag, created = create_tag({'name': 'SVC NORM ERA'})
        assert created is False
        assert tag.name == 'svc-norm-era'

    def test_admin_flag_sets_is_predefined_on_creation(self):
        tag, created = create_tag({'name': 'svc-admin-tag'}, is_predefined=True)
        assert created is True
        assert tag.is_predefined is True

    def test_user_creation_sets_is_predefined_false(self):
        tag, _ = create_tag({'name': 'svc-user-created'})
        assert tag.is_predefined is False

    def test_does_not_overwrite_is_predefined_on_existing_tag(self):
        Tag.objects.create(name='svc-keep-predefined', is_predefined=True)
        tag, created = create_tag({'name': 'svc-keep-predefined'}, is_predefined=False)
        assert created is False
        assert tag.is_predefined is True


@pytest.mark.django_db
class TestDeleteTag:
    def test_deletes_tag(self):
        tag = Tag.objects.create(name='svc-to-delete')
        delete_tag(tag)
        assert not Tag.objects.filter(name='svc-to-delete').exists()

    def test_cascade_deletes_story_tags(self):
        from apps.stories.models import Story
        from apps.users.models import User

        user = User.objects.create_user(
            email='tagger-svc@example.com', username='tagger-svc', password='Pass1234',
        )
        story = Story.objects.create(
            user=user, title='T', narrative='N',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2000,
        )
        tag = Tag.objects.create(name='svc-cascade-tag')
        st = StoryTag.objects.create(story=story, tag=tag)
        delete_tag(tag)
        assert not StoryTag.objects.filter(pk=st.pk).exists()


def _make_story(email, username):
    """Helper: create a user and a published story for service tests."""
    from apps.stories.models import Story
    from apps.users.models import User

    user = User.objects.create_user(email=email, username=username, password='Pass1234')
    story = Story.objects.create(
        user=user, title='T', narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='P', time_type=Story.TIME_EXACT, year=2000,
    )
    return story


@pytest.mark.django_db
class TestAttachTagsToStory:
    def test_creates_story_tag_rows(self):
        story = _make_story('attach1@x.com', 'attach1')
        tag = Tag.objects.create(name='svc-attach-a')
        attach_tags_to_story(story, [tag.pk])
        assert StoryTag.objects.filter(story=story, tag=tag).exists()

    def test_increments_story_count(self):
        story = _make_story('attach2@x.com', 'attach2')
        tag = Tag.objects.create(name='svc-attach-b')
        attach_tags_to_story(story, [tag.pk])
        tag.refresh_from_db()
        assert tag.story_count == 1

    def test_skips_already_linked_tags(self):
        story = _make_story('attach3@x.com', 'attach3')
        tag = Tag.objects.create(name='svc-attach-c')
        StoryTag.objects.create(story=story, tag=tag)
        attach_tags_to_story(story, [tag.pk])
        assert StoryTag.objects.filter(story=story, tag=tag).count() == 1

    def test_does_not_double_increment_for_existing_link(self):
        story = _make_story('attach4@x.com', 'attach4')
        tag = Tag.objects.create(name='svc-attach-d', story_count=1)
        StoryTag.objects.create(story=story, tag=tag)
        attach_tags_to_story(story, [tag.pk])
        tag.refresh_from_db()
        assert tag.story_count == 1


@pytest.mark.django_db
class TestSyncStoryTags:
    def test_adds_new_tags(self):
        story = _make_story('sync1@x.com', 'sync1')
        tag = Tag.objects.create(name='svc-sync-a')
        sync_story_tags(story, [tag.pk])
        assert StoryTag.objects.filter(story=story, tag=tag).exists()

    def test_increments_story_count_on_add(self):
        story = _make_story('sync2@x.com', 'sync2')
        tag = Tag.objects.create(name='svc-sync-b')
        sync_story_tags(story, [tag.pk])
        tag.refresh_from_db()
        assert tag.story_count == 1

    def test_removes_old_tags(self):
        story = _make_story('sync3@x.com', 'sync3')
        tag_old = Tag.objects.create(name='svc-sync-old')
        tag_new = Tag.objects.create(name='svc-sync-new')
        StoryTag.objects.create(story=story, tag=tag_old)
        sync_story_tags(story, [tag_new.pk])
        assert not StoryTag.objects.filter(story=story, tag=tag_old).exists()
        assert StoryTag.objects.filter(story=story, tag=tag_new).exists()

    def test_decrements_story_count_on_remove(self):
        story = _make_story('sync4@x.com', 'sync4')
        tag = Tag.objects.create(name='svc-sync-c', story_count=1)
        StoryTag.objects.create(story=story, tag=tag)
        sync_story_tags(story, [])
        tag.refresh_from_db()
        assert tag.story_count == 0

    def test_empty_list_removes_all_tags(self):
        story = _make_story('sync5@x.com', 'sync5')
        tag1 = Tag.objects.create(name='svc-sync-d')
        tag2 = Tag.objects.create(name='svc-sync-e')
        StoryTag.objects.create(story=story, tag=tag1)
        StoryTag.objects.create(story=story, tag=tag2)
        sync_story_tags(story, [])
        assert StoryTag.objects.filter(story=story).count() == 0

    def test_unchanged_tags_not_recreated(self):
        story = _make_story('sync6@x.com', 'sync6')
        tag = Tag.objects.create(name='svc-sync-f', story_count=1)
        StoryTag.objects.create(story=story, tag=tag)
        sync_story_tags(story, [tag.pk])
        tag.refresh_from_db()
        assert tag.story_count == 1
        assert StoryTag.objects.filter(story=story, tag=tag).count() == 1


@pytest.mark.django_db
class TestStoryCountSignals:
    def test_story_count_decremented_on_individual_story_delete(self):
        from apps.stories.services import delete_story

        story = _make_story('sigdel1@x.com', 'sigdel1')
        tag = Tag.objects.create(name='svc-sig-del-a')
        StoryTag.objects.create(story=story, tag=tag)
        tag.refresh_from_db()
        assert tag.story_count == 1
        delete_story(story)
        tag.refresh_from_db()
        assert tag.story_count == 0

    def test_story_count_decremented_on_bulk_story_delete(self):
        """Covers the hard account-delete path: Story.objects.filter(...).delete()."""
        from apps.stories.models import Story
        from apps.users.models import User

        user = User.objects.create_user(
            email='sigdel2@x.com', username='sigdel2', password='Pass1234',
        )
        story = Story.objects.create(
            user=user, title='T', narrative='N',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2000,
        )
        tag = Tag.objects.create(name='svc-sig-del-b')
        StoryTag.objects.create(story=story, tag=tag)
        tag.refresh_from_db()
        assert tag.story_count == 1
        Story.objects.filter(user=user).delete()
        tag.refresh_from_db()
        assert tag.story_count == 0
