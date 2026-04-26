from django.apps import AppConfig


class GamificationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.gamification'
    label = 'gamification'

    def ready(self):
        import apps.gamification.signals  # noqa: F401 — registers badge-earned notification signal
