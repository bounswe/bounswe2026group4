from django.db import models


class MediaType(models.TextChoices):
    IMAGE = 'image', 'Image'
    AUDIO = 'audio', 'Audio'
    VIDEO = 'video', 'Video'


class MediaItem(models.Model):
    """
    Stores metadata for each media file attached to a story (req. 1.4.2).

    file uses Django's FileField (not a bare CharField) so that:
    - MEDIA_ROOT resolution is handled automatically
    - The .url property composes MEDIA_URL + path, making the switch from
      local filesystem to S3/object storage a settings-only change (just
      update DEFAULT_FILE_STORAGE) with no model changes required.
    - Pillow (for images) and python-magic (for MIME type validation) are
      already in requirements/base.txt and should be wired in the serializer.

    Actual file blobs are never stored in MySQL — only the path. Files live
    on the filesystem (dev) or object storage (production).

    order controls the display sequence of media items within a story.
    """

    story = models.ForeignKey(
        'stories.Story',
        on_delete=models.CASCADE,
        related_name='media_items',
    )
    file = models.FileField(upload_to='stories/%Y/%m/')
    media_type = models.CharField(max_length=5, choices=MediaType.choices)
    file_size = models.PositiveIntegerField(help_text='File size in bytes.')
    original_filename = models.CharField(max_length=255)
    order = models.PositiveSmallIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'media_items'
        ordering = ['order', 'uploaded_at']
        indexes = [
            models.Index(fields=['story'], name='media_story_idx'),
        ]

    def __str__(self):
        return f'{self.media_type}:{self.original_filename}'
