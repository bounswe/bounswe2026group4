import pytest

from apps.tags.models import Tag
from apps.tags.services import create_tag, delete_tag, list_tags, normalize_tag_name


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
        from decimal import Decimal

        from apps.stories.models import Story
        from apps.tags.models import StoryTag
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
