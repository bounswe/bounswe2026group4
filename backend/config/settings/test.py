# Test settings
from .base import *  # noqa: F401, F403

DEBUG = False

SECRET_KEY = env('SECRET_KEY')  # noqa: F405

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': env('TEST_DB_NAME', default='historystorymap_test'),  # noqa: F405
        'USER': env('DB_USER'),  # noqa: F405
        'PASSWORD': env('DB_PASSWORD'),  # noqa: F405
        'HOST': env('DB_HOST', default='127.0.0.1'),  # noqa: F405
        'PORT': env('DB_PORT', default='3306'),  # noqa: F405
        'OPTIONS': {
            'charset': 'utf8mb4',
        },
    }
}

# Ensure debug_toolbar is not active during tests regardless of env vars.
INSTALLED_APPS = [app for app in INSTALLED_APPS if app != 'debug_toolbar']  # noqa: F405
MIDDLEWARE = [m for m in MIDDLEWARE if 'debug_toolbar' not in m]  # noqa: F405

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# Use in-memory storage so tests never touch the filesystem and are not
# affected by MEDIA_ROOT values set in .env (e.g. production/Docker paths).
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.InMemoryStorage',
    },
    'staticfiles': {
        'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
    },
}

# Disable password hashing for faster tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# Disable throttling in tests. LoginView sets throttle_classes directly on the class,
# so it bypasses DEFAULT_THROTTLE_CLASSES. The login rate must also be set very high
# so the ScopedRateThrottle on LoginView never fires during fixture setup.
# Individual rate-limit tests override DEFAULT_THROTTLE_RATES to a low limit via
# override_settings and cache.clear() before/after to isolate state.
REST_FRAMEWORK = {  # noqa: F405
    **REST_FRAMEWORK,  # noqa: F405
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '10000/minute',
        'user': '10000/minute',
        'login': '10000/minute',
    },
}
