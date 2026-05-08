import logging

from django.apps import AppConfig
from django.conf import settings

logger = logging.getLogger(__name__)


class GeocodingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.geocoding'

    def ready(self):
        email = getattr(settings, 'NOMINATIM_CONTACT_EMAIL', '')
        if not email or 'example' in email:
            logger.warning(
                'NOMINATIM_CONTACT_EMAIL is set to a placeholder (%r). '
                'Nominatim blocks requests from example/placeholder addresses with HTTP 403. '
                'Set a real contact email in .env.',
                email,
            )
