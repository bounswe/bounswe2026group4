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

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# Disable password hashing for faster tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]
