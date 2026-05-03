from django.db import migrations


BADGES = [
    # Registration
    {
        'name': 'Pioneer',
        'description': 'Joined the Local History Story Map community.',
        'criteria_type': 'registration',
        'criteria_threshold': 0,
    },

    # Stories published
    {
        'name': 'First Story',
        'description': 'Published your first story.',
        'criteria_type': 'stories_published',
        'criteria_threshold': 1,
    },
    {
        'name': 'Storyteller',
        'description': 'Published 3 stories.',
        'criteria_type': 'stories_published',
        'criteria_threshold': 3,
    },
    {
        'name': 'Contributor',
        'description': 'Published 5 stories.',
        'criteria_type': 'stories_published',
        'criteria_threshold': 5,
    },
    {
        'name': 'Historian',
        'description': 'Published 10 stories.',
        'criteria_type': 'stories_published',
        'criteria_threshold': 10,
    },
    {
        'name': 'Legend',
        'description': 'Published 50 stories.',
        'criteria_type': 'stories_published',
        'criteria_threshold': 50,
    },

    # Points total
    {
        'name': 'Rising Star',
        'description': 'Earned 50 points.',
        'criteria_type': 'points_total',
        'criteria_threshold': 50,
    },
    {
        'name': 'Active Member',
        'description': 'Earned 100 points.',
        'criteria_type': 'points_total',
        'criteria_threshold': 100,
    },
    {
        'name': 'Community Pillar',
        'description': 'Earned 200 points.',
        'criteria_type': 'points_total',
        'criteria_threshold': 200,
    },
    {
        'name': 'Expert',
        'description': 'Earned 500 points.',
        'criteria_type': 'points_total',
        'criteria_threshold': 500,
    },
    {
        'name': 'Master',
        'description': 'Earned 1000 points.',
        'criteria_type': 'points_total',
        'criteria_threshold': 1000,
    },
]


def seed_badges(apps, schema_editor):
    Badge = apps.get_model('gamification', 'Badge')
    for data in BADGES:
        Badge.objects.get_or_create(
            name=data['name'],
            defaults={
                'description': data['description'],
                'criteria_type': data['criteria_type'],
                'criteria_threshold': data['criteria_threshold'],
            },
        )


def unseed_badges(apps, schema_editor):
    Badge = apps.get_model('gamification', 'Badge')
    Badge.objects.filter(name__in=[b['name'] for b in BADGES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('gamification', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_badges, reverse_code=unseed_badges),
    ]
