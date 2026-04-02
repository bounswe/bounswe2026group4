from .base import *

# ── Hosts & CORS ──────────────────────────────────────────────────────────────

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS')

# Only the deployed frontend origin may make cross-origin requests.
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS')

# ── Static files ──────────────────────────────────────────────────────────────

# WhiteNoise serves Django's own static files (/static/) efficiently.
# It must sit directly after SecurityMiddleware.
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# ── Security headers ──────────────────────────────────────────────────────────

# Django runs behind nginx which terminates SSL; this header tells Django the
# original request was HTTPS so it sets secure cookies and enforces redirects.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Instruct browsers to always use HTTPS for this domain for 1 year.
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# ── Error tracking ────────────────────────────────────────────────────────────

SENTRY_DSN = env('SENTRY_DSN', default='')
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    sentry_sdk.init(dsn=SENTRY_DSN, integrations=[DjangoIntegration()])
