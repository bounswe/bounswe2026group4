from decimal import Decimal

import pytest

from apps.media.models import MediaItem, MediaType
from apps.stories.models import Story
from apps.users.models import User


def _make_story(user):
    return Story.objects.create(
        user=user, title='T', narrative='N',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='P', time_type=Story.TIME_EXACT, year=2000,
    )


def _make_item(story, **kwargs):
    defaults = dict(
        story=story,
        file='stories/2024/01/test.jpg',
        media_type=MediaType.IMAGE,
        file_size=1024,
        original_filename='test.jpg',
        order=0,
    )
    defaults.update(kwargs)
    return MediaItem.objects.create(**defaults)


@pytest.mark.django_db
class TestMediaItem:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='media@example.com', username='mediauser', password='Password1',
        )
        self.story = _make_story(self.user)

    def test_media_item_can_be_created(self):
        item = _make_item(self.story)
        assert item.pk is not None

    def test_order_defaults_to_zero(self):
        item = _make_item(self.story)
        assert item.order == 0

    def test_uploaded_at_is_set_automatically(self):
        item = _make_item(self.story)
        assert item.uploaded_at is not None

    def test_all_media_types_are_accepted(self):
        for media_type in MediaType.values:
            item = _make_item(self.story, media_type=media_type,
                              original_filename=f'file.{media_type}')
            assert item.media_type == media_type

    def test_file_size_is_stored_correctly(self):
        item = _make_item(self.story, file_size=2_048_576)
        item.refresh_from_db()
        assert item.file_size == 2_048_576

    def test_cascade_deletes_when_story_is_deleted(self):
        item = _make_item(self.story)
        item_pk = item.pk
        self.story.delete()
        assert not MediaItem.objects.filter(pk=item_pk).exists()

    def test_story_can_have_multiple_media_items(self):
        _make_item(self.story, original_filename='a.jpg')
        _make_item(self.story, original_filename='b.mp4', media_type=MediaType.VIDEO)
        assert MediaItem.objects.filter(story=self.story).count() == 2

    def test_items_ordered_by_order_field_ascending(self):
        # Lower order value must appear first (req. 1.3.3.4 — sequential media display)
        item_b = _make_item(self.story, order=2, original_filename='b.jpg')
        item_a = _make_item(self.story, order=1, original_filename='a.jpg')
        items = list(MediaItem.objects.filter(story=self.story))
        assert items[0].pk == item_a.pk
        assert items[1].pk == item_b.pk

    def test_str_includes_type_and_filename(self):
        item = _make_item(self.story)
        s = str(item)
        assert 'image' in s
        assert 'test.jpg' in s
