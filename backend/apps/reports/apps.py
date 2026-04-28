from django.apps import AppConfig


class ReportsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.reports'
    label = 'reports'

    def ready(self):
        import apps.reports.signals  # noqa: F401 — registers report-resolved notification signal
