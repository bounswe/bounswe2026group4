from django.apps import AppConfig


class StoriesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.stories'
    label = 'stories'

    def ready(self):
        import apps.stories.signals  # noqa: F401 — registers new-story-published notification signal
