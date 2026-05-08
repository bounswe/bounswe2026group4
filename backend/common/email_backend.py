import logging

import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)

_RESEND_API_URL = 'https://api.resend.com/emails'


class ResendEmailBackend(BaseEmailBackend):
    """
    Django email backend that delivers via the Resend HTTP API (port 443).

    Requires RESEND_API_KEY in settings. Use this instead of the SMTP backend
    on hosts that block outbound SMTP ports (465/587), such as DigitalOcean droplets.

    Configuration in .env.prod:
        EMAIL_BACKEND=common.email_backend.ResendEmailBackend
        RESEND_API_KEY=re_...
    """

    def send_messages(self, email_messages):
        api_key = getattr(settings, 'RESEND_API_KEY', '')
        if not api_key:
            if self.fail_silently:
                return 0
            raise ValueError(
                'RESEND_API_KEY is not configured. '
                'Set it in your environment to enable email delivery.'
            )

        sent = 0
        for message in email_messages:
            try:
                response = requests.post(
                    _RESEND_API_URL,
                    json={
                        'from': message.from_email,
                        'to': message.to,
                        'subject': message.subject,
                        'text': message.body,
                    },
                    headers={
                        'Authorization': f'Bearer {api_key}',
                        'Content-Type': 'application/json',
                    },
                    timeout=10,
                )
                response.raise_for_status()
                sent += 1
            except Exception as exc:
                if not self.fail_silently:
                    raise
                logger.error('Resend delivery failed for %s: %s', message.to, exc)

        return sent
