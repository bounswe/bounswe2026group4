from apps.stories.models import Story


def create_story(user, validated_data: dict) -> Story:
    """Create and persist a new story owned by the given user."""
    return Story.objects.create(user=user, **validated_data)


def update_story(story: Story, validated_data: dict) -> Story:
    """Apply partial updates to an existing story and persist the changes."""
    for attr, value in validated_data.items():
        setattr(story, attr, value)
    story.save()
    return story
