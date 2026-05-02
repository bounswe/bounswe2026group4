from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string


def send_verification_email(user_email: str, code: str) -> None:
    """Send a verification code email. Raises on delivery failure — callers decide how to handle."""
    body = render_to_string('users/emails/verification_code.txt', {'code': code})
    send_mail(
        subject='Verify your email address',
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user_email],
        fail_silently=False,
    )


def send_password_reset_email(user_email: str, reset_link: str) -> None:
    """Send a password reset link email. Raises on delivery failure — callers decide how to handle."""
    body = render_to_string('users/emails/password_reset.txt', {'reset_link': reset_link})
    send_mail(
        subject='Reset your password',
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user_email],
        fail_silently=False,
    )
