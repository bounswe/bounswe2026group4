"""Integration tests for the image upload endpoint."""
import io

import pytest
from PIL import Image
from rest_framework.test import APIClient

from apps.media.models import MediaItem, MediaType
from apps.stories.models import Story


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
