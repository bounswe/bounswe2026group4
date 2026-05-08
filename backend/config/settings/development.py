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

# When running via docker compose, email is routed through Mailpit (set in docker-compose.yml).
# Open http://localhost:8025 to see all outgoing emails in a local inbox — nothing reaches real inboxes.
# To fall back to console output, set EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend in .env.
EMAIL_BACKEND = env('EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')  # noqa: F405

# Allow the local Vite dev server to call the API
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
]

INSTALLED_APPS += ['debug_toolbar']  # noqa: F405

MIDDLEWARE = ['debug_toolbar.middleware.DebugToolbarMiddleware'] + MIDDLEWARE  # noqa: F405

DEBUG_TOOLBAR_CONFIG = {
    'SHOW_TOOLBAR_CALLBACK': lambda request: DEBUG,  # noqa: F405
}
