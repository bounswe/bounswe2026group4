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

# Print emails to the console instead of sending them
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

INSTALLED_APPS += ['debug_toolbar']  # noqa: F405

MIDDLEWARE = ['debug_toolbar.middleware.DebugToolbarMiddleware'] + MIDDLEWARE  # noqa: F405


DEBUG_TOOLBAR_CONFIG = {
    'SHOW_TOOLBAR_CALLBACK': lambda request: DEBUG,  # noqa: F405
}
