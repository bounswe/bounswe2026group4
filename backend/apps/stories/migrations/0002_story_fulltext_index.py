"""
Adds a MySQL FULLTEXT index over title, narrative_text, and place_name.

Django's Index class does not support FULLTEXT indexes, so we use RunSQL.
The index enables natural-language and boolean-mode full-text search against
story content and location name, satisfying req. 1.3.5.1.

MySQL FULLTEXT notes:
- Default minimum word length is 4 characters (ft_min_word_len). Words shorter
  than this are ignored. Override in MySQL config if short place names matter.
- Stopwords (common words like "the", "a") are excluded from the index.
- The search query should use MATCH … AGAINST … IN BOOLEAN MODE for prefix
  searches and exact phrase matching via the stories manager.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('stories', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                'ALTER TABLE stories ADD FULLTEXT INDEX story_fulltext_idx '
                '(title, narrative_text, place_name)'
            ),
            reverse_sql='ALTER TABLE stories DROP INDEX story_fulltext_idx',
        ),
    ]
