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
        self._warn_if_frontend_url_misconfigured()

    def _warn_if_email_misconfigured(self):
        from django.conf import settings
        backend = getattr(settings, 'EMAIL_BACKEND', '')
        backend_lower = backend.lower()
        # Only check real sending backends; console/file/locmem are dev-only.
        is_smtp = 'smtp' in backend_lower
        is_resend = 'resend' in backend_lower
        if not is_smtp and not is_resend:
            return
        if is_smtp and not getattr(settings, 'EMAIL_HOST_PASSWORD', ''):
            logger.warning(
                'EMAIL_HOST_PASSWORD is not set — SMTP email delivery will fail. '
                'Set it in .env or use EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend for development.'
            )
        if is_resend and not getattr(settings, 'RESEND_API_KEY', ''):
            logger.warning(
                'RESEND_API_KEY is not set — Resend email delivery will fail. '
                'Set it in .env or use EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend for development.'
            )
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', '')
        if 'example.com' in from_email:
            logger.warning(
                'DEFAULT_FROM_EMAIL contains "example.com" — emails will likely be rejected. '
                'Set DEFAULT_FROM_EMAIL to a verified sender address in .env.'
            )

    def _warn_if_frontend_url_misconfigured(self):
        from django.conf import settings
        if getattr(settings, 'DEBUG', True):
            return
        frontend_url = getattr(settings, 'FRONTEND_URL', '')
        if not frontend_url or 'localhost' in frontend_url or '127.0.0.1' in frontend_url:
            logger.warning(
                'FRONTEND_URL is set to "%s" — password reset email links will point '
                'to localhost and will not work in production. '
                'Set FRONTEND_URL to your deployed frontend URL in .env.', frontend_url
            )
