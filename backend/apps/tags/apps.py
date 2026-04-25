from django.apps import AppConfig


class TagsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.tags'

    def ready(self):
        import apps.tags.signals  # noqa: F401 — registers post_save/post_delete on StoryTag
