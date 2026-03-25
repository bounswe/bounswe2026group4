from django.core.validators import RegexValidator
from django.db import models


class Tag(models.Model):
    """
    Shared tag vocabulary. Tags are normalized into their own table so they can
    be searched efficiently by name, browsed for autocomplete, and re-used across
    stories without duplication.

    name is enforced to be lowercase-with-dashes (req. 1.3.6.4) via a validator
    applied at the model layer so the constraint holds regardless of how a tag
    is created (admin, API, management command).

    story_count is a denormalized counter used for autocomplete ordering ("show
    most popular tags first") without an expensive COUNT query on story_tags.
    """

    name = models.CharField(
        max_length=50,
        unique=True,
        validators=[
            RegexValidator(
                regex=r'^[a-z0-9]+(-[a-z0-9]+)*$',
                message='Tag must be lowercase letters/digits separated by hyphens (e.g. ottoman-era).',
            )
        ],
    )
    is_predefined = models.BooleanField(default=False)
    story_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'tags'

    def __str__(self):
        return self.name


class StoryTag(models.Model):
    """
    Explicit through-table for the Story ↔ Tag M2M relationship.
    Using an explicit model (rather than ManyToManyField.through=…) makes
    it straightforward to enforce the max-3-tags-per-story rule in the
    serializer and to add the unique constraint that prevents duplicate tags.
    """

    story = models.ForeignKey(
        'stories.Story',
        on_delete=models.CASCADE,
        related_name='story_tags',
    )
    tag = models.ForeignKey(
        Tag,
        on_delete=models.CASCADE,
        related_name='story_tags',
    )

    class Meta:
        db_table = 'story_tags'
        constraints = [
            models.UniqueConstraint(fields=['story', 'tag'], name='unique_story_tag'),
        ]
        indexes = [
            models.Index(fields=['tag'], name='storytag_tag_idx'),
        ]

    def __str__(self):
        return f'{self.story_id} → {self.tag.name}'
