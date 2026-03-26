# Development settings
import sys
from datetime import timedelta

from .base import *  # noqa: F401, F403

DEBUG = True
RUNNING_TESTS = 'test' in sys.argv

SECRET_KEY = env('SECRET_KEY')  # noqa: F405

ALLOWED_HOSTS = ['localhost', '127.0.0.1']

# Longer token lifetime in dev for convenience
SIMPLE_JWT = {
    **SIMPLE_JWT,  # noqa: F405
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
}

# Print emails to the console instead of sending them
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

if not RUNNING_TESTS:
    INSTALLED_APPS += ['debug_toolbar']  # noqa: F405

if not RUNNING_TESTS:
    MIDDLEWARE = ['debug_toolbar.middleware.DebugToolbarMiddleware'] + MIDDLEWARE  # noqa: F405


DEBUG_TOOLBAR_CONFIG = {
    'SHOW_TOOLBAR_CALLBACK': lambda request: DEBUG and not RUNNING_TESTS,  # noqa: F405
    'IS_RUNNING_TESTS': RUNNING_TESTS,
}
