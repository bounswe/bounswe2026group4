import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.users'
    label = 'users'

    def ready(self):
        import apps.users.signals  # noqa: F401
        self._warn_if_email_misconfigured()

    def _warn_if_email_misconfigured(self):
        from django.conf import settings
        backend = getattr(settings, 'EMAIL_BACKEND', '')
        if 'smtp' not in backend.lower():
            return
        # Skip credential checks in DEBUG — local catchers like Mailpit need no auth
        if not getattr(settings, 'DEBUG', False):
            if not getattr(settings, 'EMAIL_HOST_PASSWORD', ''):
                logger.warning(
                    'EMAIL_HOST_PASSWORD is not set — SMTP email delivery will fail. '
                    'Set it in .env or use EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend for development.'
                )
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', '')
            if 'example.com' in from_email:
                logger.warning(
                    'DEFAULT_FROM_EMAIL contains "example.com" — emails will likely be rejected. '
                    'Set DEFAULT_FROM_EMAIL to a verified sender address in .env.'
                )
