# Development settings
from datetime import timedelta

from .base import *  # noqa: F401, F403

DEBUG = True

SECRET_KEY = env('SECRET_KEY')  # noqa: F405

ALLOWED_HOSTS = ['localhost', '127.0.0.1']

# Longer token lifetime in dev for convenience
SIMPLE_JWT = {
    **SIMPLE_JWT,  # noqa: F405
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
}

# Console backend by default in dev — emails are printed to Docker logs, not delivered to inboxes.
# To find a verification code: docker compose logs web | grep -A 10 "Verify your email"
# Override via EMAIL_BACKEND env var (e.g. smtp.EmailBackend) to test real delivery.
EMAIL_BACKEND = env('EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')  # noqa: F405

# Allow the local Vite dev server to call the API
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
]

INSTALLED_APPS += ['debug_toolbar']  # noqa: F405

MIDDLEWARE = ['debug_toolbar.middleware.DebugToolbarMiddleware'] + MIDDLEWARE  # noqa: F405

DEBUG_TOOLBAR_CONFIG = {
    'SHOW_TOOLBAR_CALLBACK': lambda request: DEBUG,  # noqa: F405
}
