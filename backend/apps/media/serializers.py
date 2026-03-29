from rest_framework import serializers

from apps.media.models import MediaItem

ALLOWED_MIME_TYPES = {'image/jpeg', 'image/png'}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2 MB


class ImageUploadSerializer(serializers.Serializer):
    """
    Validates a POST /stories/<id>/images/ request.

    Uses DRF's ImageField (backed by Pillow) as a first layer of validation —
    it confirms the file is actually a decodable image. A second layer then
    restricts the accepted MIME type to JPEG and PNG only, and enforces
    the 2 MB size limit.
    """

    file = serializers.ImageField()

    def validate_file(self, value):
        if value.content_type not in ALLOWED_MIME_TYPES:
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
