"""Unit tests for media serializers."""
import io

import pytest
from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image


def make_image_file(fmt='JPEG', name='photo.jpg', content_type='image/jpeg', size_override=None):
    """
    Build an InMemoryUploadedFile containing a minimal image in the given format.

    size_override lets tests exercise the file-size validation without allocating
    megabytes of real data in memory: InMemoryUploadedFile.size is the value that
    the serializer reads, so overriding it is sufficient to trigger the limit check.
    """
    buf = io.BytesIO()
    Image.new('RGB', (10, 10), color=(255, 0, 0)).save(buf, format=fmt)
    buf.seek(0)
    reported_size = size_override if size_override is not None else len(buf.getvalue())
    return InMemoryUploadedFile(
        file=buf,
        field_name='file',
        name=name,
        content_type=content_type,
        size=reported_size,
        charset=None,
    )


# ── ImageUploadSerializer ─────────────────────────────────────────────────────

class TestImageUploadSerializer:
    """
    Pure-Python validation tests — no database access needed.
    """

    def _serialize(self, file_obj):
        from apps.media.serializers import ImageUploadSerializer
        s = ImageUploadSerializer(data={'file': file_obj})
        s.is_valid()
        return s

    def test_valid_jpeg_passes(self):
        s = self._serialize(make_image_file('JPEG', 'photo.jpg', 'image/jpeg'))
        assert s.is_valid(), s.errors

    def test_valid_png_passes(self):
        s = self._serialize(make_image_file('PNG', 'photo.png', 'image/png'))
        assert s.is_valid(), s.errors

    def test_gif_rejected_by_mime_detection(self):
        # python-magic detects image/gif → rejected regardless of extension
        s = self._serialize(make_image_file('GIF', 'anim.gif', 'image/gif'))
        assert not s.is_valid()
        assert 'file' in s.errors

    def test_spoofed_gif_declared_as_jpeg_rejected(self):
        # GIF bytes with Content-Type: image/jpeg — python-magic must catch this
        s = self._serialize(make_image_file('GIF', 'sneaky.jpg', 'image/jpeg'))
        assert not s.is_valid()
        assert 'file' in s.errors

    def test_spoofed_bmp_declared_as_jpeg_rejected(self):
        s = self._serialize(make_image_file('BMP', 'trick.jpg', 'image/jpeg'))
        assert not s.is_valid()
        assert 'file' in s.errors

    def test_oversized_file_rejected(self):
        # Use size_override so we don't allocate 2MB in RAM
        oversized = make_image_file(size_override=2 * 1024 * 1024 + 1)
        s = self._serialize(oversized)
        assert not s.is_valid()
        assert 'file' in s.errors

    def test_exactly_2mb_is_accepted(self):
        edge = make_image_file(size_override=2 * 1024 * 1024)
        s = self._serialize(edge)
        assert s.is_valid(), s.errors

    def test_error_message_mentions_jpeg_and_png(self):
        s = self._serialize(make_image_file('GIF', 'x.gif', 'image/gif'))
        assert not s.is_valid()
        error_text = str(s.errors)
        assert 'JPEG' in error_text or 'PNG' in error_text


# ── MediaItemResponseSerializer ───────────────────────────────────────────────

@pytest.mark.django_db
class TestMediaItemResponseSerializer:
    def _make_item(self):
        from decimal import Decimal
        from apps.media.models import MediaItem, MediaType
        from apps.stories.models import Story
        from apps.users.models import User

        user = User.objects.create_user(
            email='msr@example.com', username='msruser', password='Password1'
        )
        story = Story.objects.create(
            user=user, title='T', narrative='N',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2000,
        )
        return MediaItem.objects.create(
            story=story,
            file='stories/2024/01/test.jpg',
            media_type=MediaType.IMAGE,
            file_size=1024,
            original_filename='test.jpg',
        )

    def test_contains_expected_fields(self):
        from apps.media.serializers import MediaItemResponseSerializer
        data = MediaItemResponseSerializer(self._make_item()).data
        for field in ['id', 'url', 'file_size', 'original_filename', 'uploaded_at']:
            assert field in data

    def test_url_is_built_from_request_context(self):
        from unittest.mock import MagicMock
        from apps.media.serializers import MediaItemResponseSerializer

        mock_request = MagicMock()
        mock_request.build_absolute_uri.return_value = 'http://testserver/media/stories/2024/01/test.jpg'
        data = MediaItemResponseSerializer(
            self._make_item(), context={'request': mock_request}
        ).data
        assert data['url'] == 'http://testserver/media/stories/2024/01/test.jpg'
        mock_request.build_absolute_uri.assert_called_once()

    def test_url_falls_back_to_relative_without_request(self):
        from apps.media.serializers import MediaItemResponseSerializer
        data = MediaItemResponseSerializer(self._make_item()).data
        # No request in context — URL must still be present but relative
        assert 'url' in data
        assert data['url'] is not None
