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
        # Credential checks are skipped in DEBUG mode because local dev catchers
        # (Mailpit, MailHog) accept SMTP with no authentication. These warnings
        # are only meaningful for production deployments where DEBUG=False.
        if not getattr(settings, 'DEBUG', False):
            if not getattr(settings, 'EMAIL_HOST_PASSWORD', ''):
                logger.warning(
                    'EMAIL_HOST_PASSWORD is not set — SMTP email delivery will fail. '
                    'Set it in .env or use EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend for development.'
                )
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', '')
            # Catch both the legacy placeholder (example.com) and the current one
            # (yourdomain.example / any .example TLD) to avoid false negatives.
            if 'example.com' in from_email or '.example' in from_email:
                logger.warning(
                    'DEFAULT_FROM_EMAIL looks like a placeholder — emails will likely be rejected. '
                    'Set DEFAULT_FROM_EMAIL to a verified sender address in .env.'
                )
