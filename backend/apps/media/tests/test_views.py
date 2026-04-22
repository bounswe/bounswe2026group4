"""Integration tests for the image and media upload endpoints."""
import io

import pytest
from PIL import Image
from rest_framework.test import APIClient

from apps.media.models import MediaItem, MediaType
from apps.stories.models import Story

# Minimal magic-byte content for each audio/video format (mirrors test_serializers.py).
_MEDIA_MAGIC_BYTES = {
    'mp3':  b'\xff\xfb\x90\x00' + b'\x00' * 60,
    'mp4':  b'\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2',
    'webm': (b'\x1a\x45\xdf\xa3\x01\x00\x00\x00\x00\x00\x00\x1f'
             b'\x42\x86\x81\x01\x42\xf7\x81\x01\x42\xf2\x81\x04'
             b'\x42\xf3\x81\x08\x42\x82\x84webm\x42\x87\x81\x04'),
}
_MEDIA_CONTENT_TYPES = {'mp3': 'audio/mpeg', 'mp4': 'video/mp4', 'webm': 'video/webm'}


def make_media_file(ext='mp3'):
    """Create an in-memory audio/video file suitable for multipart upload."""
    buf = io.BytesIO(_MEDIA_MAGIC_BYTES[ext])
    buf.seek(0)
    buf.name = f'media.{ext}'
    buf.content_type = _MEDIA_CONTENT_TYPES[ext]
    return buf


def make_image_file(name='photo.jpg', fmt='JPEG', content_type='image/jpeg', size_bytes=None):
    """
    Create a minimal in-memory image file suitable for multipart upload.

    size_bytes overrides the image content with padding to hit a target file size
    (used to test the 2 MB limit).
    """
    buf = io.BytesIO()
    img = Image.new('RGB', (10, 10), color=(255, 0, 0))
    img.save(buf, format=fmt)
    if size_bytes is not None:
        # Pad the buffer so the upload's .size attribute reflects the target
        padding = size_bytes - buf.tell()
        if padding > 0:
            buf.write(b'\x00' * padding)
    buf.seek(0)
    buf.name = name
    buf.content_type = content_type
    return buf


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def auth_client(client, user):
    client.force_authenticate(user=user)
    return client


# ── POST /stories/<story_id>/images/ ────────────────────────────────────────

@pytest.mark.django_db
class TestStoryImageUpload:
    url = '/stories/{story_id}/images/'

    def test_upload_success(self, auth_client, story):
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'file': make_image_file()},
            format='multipart',
        )
        assert response.status_code == 201
        assert 'image' in response.data
        assert MediaItem.objects.filter(story=story, media_type=MediaType.IMAGE).exists()

    def test_upload_response_contains_expected_fields(self, auth_client, story):
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'file': make_image_file()},
            format='multipart',
        )
        assert response.status_code == 201
        image_data = response.data['image']
        for field in ['id', 'url', 'file_size', 'original_filename', 'uploaded_at']:
            assert field in image_data

    def test_upload_unauthenticated_returns_401(self, client, story):
        response = client.post(
            self.url.format(story_id=story.pk),
            {'file': make_image_file()},
            format='multipart',
        )
        assert response.status_code == 401

    def test_upload_by_non_owner_returns_403(self, client, second_user, story):
        client.force_authenticate(user=second_user)
        response = client.post(
            self.url.format(story_id=story.pk),
            {'file': make_image_file()},
            format='multipart',
        )
        assert response.status_code == 403

    def test_upload_story_not_found_returns_404(self, auth_client):
        response = auth_client.post(
            self.url.format(story_id=99999),
            {'file': make_image_file()},
            format='multipart',
        )
        assert response.status_code == 404

    def test_upload_to_removed_story_returns_404(self, auth_client, story):
        story.status = Story.STATUS_REMOVED
        story.save()
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'file': make_image_file()},
            format='multipart',
        )
        assert response.status_code == 404

    def test_upload_invalid_type_gif_returns_400(self, auth_client, story):
        # GIF is not an accepted format
        buf = io.BytesIO()
        Image.new('RGB', (10, 10)).save(buf, format='GIF')
        buf.seek(0)
        buf.name = 'animation.gif'
        buf.content_type = 'image/gif'

        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'file': buf},
            format='multipart',
        )
        assert response.status_code == 400

    def test_upload_oversized_file_returns_400(self, auth_client, story):
        # Build a file whose .size exceeds 2 MB (2 * 1024 * 1024 + 1 bytes)
        oversized = make_image_file(size_bytes=2 * 1024 * 1024 + 1)
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'file': oversized},
            format='multipart',
        )
        assert response.status_code == 400

    def test_upload_png_accepted(self, auth_client, story):
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'file': make_image_file(name='image.png', fmt='PNG', content_type='image/png')},
            format='multipart',
        )
        assert response.status_code == 201

    def test_upload_stores_correct_metadata(self, auth_client, story):
        file = make_image_file(name='test.jpg')
        auth_client.post(
            self.url.format(story_id=story.pk),
            {'file': file},
            format='multipart',
        )
        item = MediaItem.objects.get(story=story)
        assert item.media_type == MediaType.IMAGE
        assert item.original_filename == 'test.jpg'
        assert item.file_size > 0

    def test_upload_draft_story_allowed(self, auth_client, user):
        """Story owners may attach images to draft stories as well."""
        from decimal import Decimal
        draft = Story.objects.create(
            user=user,
            title='Draft Story',
            narrative='Draft narrative.',
            status=Story.STATUS_DRAFT,
            location_lat=Decimal('41.0'),
            location_lng=Decimal('29.0'),
            location_name='Istanbul',
            time_type=Story.TIME_EXACT,
            year=2000,
        )
        response = auth_client.post(
            self.url.format(story_id=draft.pk),
            {'file': make_image_file()},
            format='multipart',
        )
        assert response.status_code == 201


# ── POST /stories/<story_id>/media/ ─────────────────────────────────────────

@pytest.mark.django_db
class TestStoryMediaUpload:
    url = '/stories/{story_id}/media/'

    def test_upload_audio_success(self, auth_client, story):
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'file': make_media_file('mp3')},
            format='multipart',
        )
        assert response.status_code == 201
        assert 'media' in response.data
        assert MediaItem.objects.filter(story=story, media_type=MediaType.AUDIO).exists()

    def test_upload_video_success(self, auth_client, story):
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'file': make_media_file('mp4')},
            format='multipart',
        )
        assert response.status_code == 201
        assert MediaItem.objects.filter(story=story, media_type=MediaType.VIDEO).exists()

    def test_response_contains_expected_fields(self, auth_client, story):
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'file': make_media_file('mp3')},
            format='multipart',
        )
        assert response.status_code == 201
        media_data = response.data['media']
        for field in ['id', 'media_type', 'url', 'file_size', 'original_filename', 'uploaded_at']:
            assert field in media_data

    def test_audio_media_type_in_response(self, auth_client, story):
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'file': make_media_file('mp3')},
            format='multipart',
        )
        assert response.data['media']['media_type'] == 'audio'

    def test_video_media_type_in_response(self, auth_client, story):
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'file': make_media_file('mp4')},
            format='multipart',
        )
        assert response.data['media']['media_type'] == 'video'

    def test_unauthenticated_returns_401(self, client, story):
        response = client.post(
            self.url.format(story_id=story.pk),
            {'file': make_media_file('mp3')},
            format='multipart',
        )
        assert response.status_code == 401

    def test_non_owner_returns_403(self, client, second_user, story):
        client.force_authenticate(user=second_user)
        response = client.post(
            self.url.format(story_id=story.pk),
            {'file': make_media_file('mp3')},
            format='multipart',
        )
        assert response.status_code == 403

    def test_story_not_found_returns_404(self, auth_client):
        response = auth_client.post(
            self.url.format(story_id=99999),
            {'file': make_media_file('mp3')},
            format='multipart',
        )
        assert response.status_code == 404

    def test_removed_story_returns_404(self, auth_client, story):
        story.status = Story.STATUS_REMOVED
        story.save()
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'file': make_media_file('mp3')},
            format='multipart',
        )
        assert response.status_code == 404

    def test_unsupported_type_returns_400(self, auth_client, story):
        response = auth_client.post(
            self.url.format(story_id=story.pk),
            {'file': make_image_file()},
            format='multipart',
        )
        assert response.status_code == 400

    def test_upload_stores_correct_metadata(self, auth_client, story):
        auth_client.post(
            self.url.format(story_id=story.pk),
            {'file': make_media_file('mp3')},
            format='multipart',
        )
        item = MediaItem.objects.get(story=story, media_type=MediaType.AUDIO)
        assert item.original_filename == 'media.mp3'
        assert item.file_size > 0
