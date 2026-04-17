from apps.media.models import MediaItem, MediaType


def upload_story_image(story, file):
    """
    Save an image file as a MediaItem attached to a story.

    The caller is responsible for validating the file type and size before
    calling this function (via ImageUploadSerializer).

    Returns the saved MediaItem instance.
    """
    return MediaItem.objects.create(
        story=story,
        file=file,
        media_type=MediaType.IMAGE,
        file_size=file.size,
        original_filename=file.name,
    )


def upload_story_media(story, file, media_type):
    """
    Save an audio or video file as a MediaItem attached to a story.

    The caller is responsible for validating the file type and size before
    calling this function (via MediaFileUploadSerializer).

    Returns the saved MediaItem instance.
    """
    return MediaItem.objects.create(
        story=story,
        file=file,
        media_type=media_type,
        file_size=file.size,
        original_filename=file.name,
    )
