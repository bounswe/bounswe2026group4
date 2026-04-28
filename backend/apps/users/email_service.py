import logging

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def send_verification_email(user_email: str, code: str) -> None:
    try:
        body = render_to_string('users/emails/verification_code.txt', {'code': code})
        send_mail(
            subject='Verify your email address',
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user_email],
            fail_silently=False,
        )
    except Exception:
        logger.exception('Failed to send verification email to %s', user_email)


def send_password_reset_email(user_email: str, reset_link: str) -> None:
    try:
        body = render_to_string('users/emails/password_reset.txt', {'reset_link': reset_link})
        send_mail(
            subject='Reset your password',
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user_email],
            fail_silently=False,
        )
    except Exception:
        logger.exception('Failed to send password reset email to %s', user_email)
