import magic
from rest_framework import serializers

from apps.media.models import MediaItem

ALLOWED_MIME_TYPES = {'image/jpeg', 'image/png'}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2 MB


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


class MediaItemResponseSerializer(serializers.ModelSerializer):
    """Read-only representation of a MediaItem returned after a successful upload."""

    # Build an absolute URL so clients do not need to know MEDIA_URL
    url = serializers.SerializerMethodField()

    class Meta:
        model = MediaItem
        fields = ['id', 'url', 'file_size', 'original_filename', 'uploaded_at']

    def get_url(self, obj):
        request = self.context.get('request')
        if request is not None:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url
