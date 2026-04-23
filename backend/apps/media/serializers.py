import magic
from rest_framework import serializers

from apps.media.models import MediaItem, MediaType

ALLOWED_MIME_TYPES = {'image/jpeg', 'image/png'}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2 MB

ALLOWED_AUDIO_MIME_TYPES = {'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg'}
ALLOWED_VIDEO_MIME_TYPES = {'video/mp4', 'video/webm'}
ALLOWED_MEDIA_MIME_TYPES = ALLOWED_AUDIO_MIME_TYPES | ALLOWED_VIDEO_MIME_TYPES

MIME_TO_MEDIA_TYPE = {
    **{mime: MediaType.AUDIO for mime in ALLOWED_AUDIO_MIME_TYPES},
    **{mime: MediaType.VIDEO for mime in ALLOWED_VIDEO_MIME_TYPES},
}

MAX_AUDIO_FILE_SIZE = 10 * 1024 * 1024   # 10 MB
MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024   # 50 MB


class ImageUploadSerializer(serializers.Serializer):
    """
    Validates a POST /stories/<id>/images/ request.

    Two-layer validation:
    1. DRF's ImageField (backed by Pillow) confirms the file is a decodable image.
    2. python-magic reads the first 1 024 bytes of the actual file content to detect
       the real MIME type — independent of the HTTP Content-Type header, which is
       client-controlled and trivially spoofed.

    Only image/jpeg and image/png pass both layers.
    """

    file = serializers.ImageField()

    def validate_file(self, value):
        # Detect MIME type from file bytes, not the spoofable Content-Type header.
        value.seek(0)
        detected_mime = magic.from_buffer(value.read(1024), mime=True)
        value.seek(0)

        if detected_mime not in ALLOWED_MIME_TYPES:
            raise serializers.ValidationError(
                'Unsupported file type. Only JPEG and PNG images are accepted.'
            )
        if value.size > MAX_FILE_SIZE:
            raise serializers.ValidationError(
                'File size must not exceed 2 MB.'
            )
        return value


class MediaFileUploadSerializer(serializers.Serializer):
    """
    Validates a POST /stories/<id>/media/ request (audio and video).

    Uses python-magic to detect the real MIME type from file bytes, independent
    of the spoofable HTTP Content-Type header. On success, validated_data includes
    both 'file' and 'media_type' so the view can pass both to the service.
    """

    file = serializers.FileField()

    def validate_file(self, value):
        value.seek(0)
        detected_mime = magic.from_buffer(value.read(1024), mime=True)
        value.seek(0)

        if detected_mime not in ALLOWED_MEDIA_MIME_TYPES:
            raise serializers.ValidationError(
                'Unsupported file type. '
                'Accepted audio formats: mp3, wav, ogg. '
                'Accepted video formats: mp4, webm.'
            )

        max_size = (
            MAX_AUDIO_FILE_SIZE
            if detected_mime in ALLOWED_AUDIO_MIME_TYPES
            else MAX_VIDEO_FILE_SIZE
        )
        if value.size > max_size:
            limit_mb = max_size // (1024 * 1024)
            raise serializers.ValidationError(
                f'File size must not exceed {limit_mb} MB.'
            )

        value._detected_mime = detected_mime
        return value

    def validate(self, attrs):
        attrs['media_type'] = MIME_TO_MEDIA_TYPE[attrs['file']._detected_mime]
        return attrs


class MediaItemResponseSerializer(serializers.ModelSerializer):
    """Read-only representation of a MediaItem returned after a successful upload."""

    # Build an absolute URL so clients do not need to know MEDIA_URL
    url = serializers.SerializerMethodField()

    class Meta:
        model = MediaItem
        fields = ['id', 'media_type', 'url', 'file_size', 'original_filename', 'uploaded_at']

    def get_url(self, obj):
        request = self.context.get('request')
        if request is not None:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url
