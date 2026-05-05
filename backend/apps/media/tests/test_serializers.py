"""Unit tests for media serializers."""
import io

import pytest
from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image

# Minimal magic-byte headers for each supported audio/video format.
# python-magic identifies the MIME type from these header bytes alone —
# no real audio/video payload is needed.
_MEDIA_MAGIC_BYTES = {
    'mp3':  b'\xff\xfb\x90\x00' + b'\x00' * 60,
    'wav':  (b'RIFF\x00\x00\x00\x00WAVEfmt '
             b'\x10\x00\x00\x00\x01\x00\x01\x00'
             b'\x44\xac\x00\x00\x88\x58\x01\x00'
             b'\x02\x00\x10\x00data\x00\x00\x00\x00'),
    'ogg':  (b'OggS\x00\x02\x00\x00\x00\x00\x00\x00\x00\x00'
             b'\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'
             b'\x01\x1e\x01vorbis\x00\x00\x00\x00\x02'
             b'\x44\xac\x00\x00\x00\x00\x00\x00\x00\xee\x02\x00'
             b'\x00\xee\x02\x00\xb8\x01\x01'),
    'mp4':  b'\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2',
    'webm': (b'\x1a\x45\xdf\xa3\x01\x00\x00\x00\x00\x00\x00\x1f'
             b'\x42\x86\x81\x01\x42\xf7\x81\x01\x42\xf2\x81\x04'
             b'\x42\xf3\x81\x08\x42\x82\x84webm\x42\x87\x81\x04'),
}
_MEDIA_CONTENT_TYPES = {
    'mp3': 'audio/mpeg', 'wav': 'audio/x-wav', 'ogg': 'audio/ogg',
    'mp4': 'video/mp4', 'webm': 'video/webm',
}


def make_media_file(ext='mp3', name=None, size_override=None):
    """Build an InMemoryUploadedFile with correct magic bytes for the given format."""
    content = _MEDIA_MAGIC_BYTES[ext]
    buf = io.BytesIO(content)
    reported_size = size_override if size_override is not None else len(content)
    return InMemoryUploadedFile(
        file=buf,
        field_name='file',
        name=name or f'media.{ext}',
        content_type=_MEDIA_CONTENT_TYPES[ext],
        size=reported_size,
        charset=None,
    )


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


# ── MediaFileUploadSerializer ─────────────────────────────────────────────────

class TestMediaFileUploadSerializer:
    """Pure-Python validation tests — no database access needed."""

    def _serialize(self, file_obj):
        from apps.media.serializers import MediaFileUploadSerializer
        s = MediaFileUploadSerializer(data={'file': file_obj})
        s.is_valid()
        return s

    def test_valid_mp3_passes(self):
        s = self._serialize(make_media_file('mp3'))
        assert s.is_valid(), s.errors

    def test_valid_wav_passes(self):
        s = self._serialize(make_media_file('wav'))
        assert s.is_valid(), s.errors

    def test_valid_mp4_passes(self):
        s = self._serialize(make_media_file('mp4'))
        assert s.is_valid(), s.errors

    def test_valid_webm_passes(self):
        s = self._serialize(make_media_file('webm'))
        assert s.is_valid(), s.errors

    def test_image_rejected(self):
        # JPEG magic bytes are not in the allowed audio/video MIME set
        s = self._serialize(make_image_file())
        assert not s.is_valid()
        assert 'file' in s.errors

    def test_mp3_media_type_is_audio(self):
        from apps.media.models import MediaType
        s = self._serialize(make_media_file('mp3'))
        assert s.is_valid(), s.errors
        assert s.validated_data['media_type'] == MediaType.AUDIO

    def test_mp4_media_type_is_video(self):
        from apps.media.models import MediaType
        s = self._serialize(make_media_file('mp4'))
        assert s.is_valid(), s.errors
        assert s.validated_data['media_type'] == MediaType.VIDEO

    def test_oversized_audio_rejected(self):
        oversized = make_media_file('mp3', size_override=10 * 1024 * 1024 + 1)
        s = self._serialize(oversized)
        assert not s.is_valid()
        assert 'file' in s.errors

    def test_oversized_video_rejected(self):
        oversized = make_media_file('mp4', size_override=50 * 1024 * 1024 + 1)
        s = self._serialize(oversized)
        assert not s.is_valid()
        assert 'file' in s.errors

    def test_error_message_mentions_accepted_formats(self):
        s = self._serialize(make_image_file())
        assert not s.is_valid()
        error_text = str(s.errors)
        assert 'mp3' in error_text or 'mp4' in error_text


# ── MediaItemResponseSerializer ───────────────────────────────────────────────

@pytest.mark.django_db
class TestMediaItemResponseSerializer:
    def _make_item(self):
        from decimal import Decimal
        from apps.media.models import MediaItem, MediaType
        from apps.stories.models import Story
        from apps.users.models import User

        user = User.objects.create_user(
            email='msr@example.com', username='msruser', password='Password1', is_active=True,
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
        for field in ['id', 'media_type', 'url', 'file_size', 'original_filename', 'uploaded_at']:
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
