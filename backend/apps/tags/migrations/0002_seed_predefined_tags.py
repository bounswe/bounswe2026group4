from django.db import migrations

from apps.tags.predefined import PREDEFINED_TAGS


def seed_predefined_tags(apps, schema_editor):
    Tag = apps.get_model('tags', 'Tag')
    for name in PREDEFINED_TAGS:
        Tag.objects.update_or_create(name=name, defaults={'is_predefined': True})


def unseed_predefined_tags(apps, schema_editor):
    # On reverse: mark these tags as no longer predefined rather than deleting them,
    # since user-created stories may already reference them via StoryTag.
    Tag = apps.get_model('tags', 'Tag')
    Tag.objects.filter(name__in=PREDEFINED_TAGS).update(is_predefined=False)


class Migration(migrations.Migration):

    dependencies = [
        ('tags', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_predefined_tags, reverse_code=unseed_predefined_tags),
    ]
