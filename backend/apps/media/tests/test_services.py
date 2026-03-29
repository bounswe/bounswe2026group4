"""Unit tests for media services."""
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

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


def _make_fake_file(name='photo.jpg', size=1024):
    """Minimal JPEG-magic-byte file wrapped in SimpleUploadedFile."""
    content = b'\xff\xd8\xff' + b'\x00' * (size - 3)
    return SimpleUploadedFile(name=name, content=content, content_type='image/jpeg')


@pytest.mark.django_db
class TestUploadStoryImage:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='svc@example.com', username='svcuser', password='Password1'
        )
        self.story = _make_story(self.user)

    def test_creates_media_item(self):
        from apps.media.services import upload_story_image
        file = _make_fake_file()
        item = upload_story_image(self.story, file)
        assert MediaItem.objects.filter(pk=item.pk).exists()

    def test_media_type_is_image(self):
        from apps.media.services import upload_story_image
        item = upload_story_image(self.story, _make_fake_file())
        assert item.media_type == MediaType.IMAGE

    def test_story_is_set(self):
        from apps.media.services import upload_story_image
        item = upload_story_image(self.story, _make_fake_file())
        assert item.story_id == self.story.pk

    def test_file_size_is_stored(self):
        from apps.media.services import upload_story_image
        file = _make_fake_file(size=2048)
        item = upload_story_image(self.story, file)
        assert item.file_size == 2048

    def test_original_filename_is_stored(self):
        from apps.media.services import upload_story_image
        file = _make_fake_file(name='my_photo.jpg')
        item = upload_story_image(self.story, file)
        assert item.original_filename == 'my_photo.jpg'

    def test_returns_media_item_instance(self):
        from apps.media.services import upload_story_image
        result = upload_story_image(self.story, _make_fake_file())
        assert isinstance(result, MediaItem)
