from django.core.management.base import BaseCommand, CommandError

from apps.users.email_service import send_password_reset_email, send_verification_email


class Command(BaseCommand):
    help = 'Send a test verification and password-reset email to verify the email provider is working.'

    def add_arguments(self, parser):
        parser.add_argument('recipient', type=str, help='Email address to send the test emails to')

    def handle(self, *args, **options):
        recipient = options['recipient']

        self.stdout.write(f'Sending test verification email to {recipient} ...')
        send_verification_email(recipient, '123456')
        self.stdout.write(self.style.SUCCESS('  Verification email dispatched.'))

        self.stdout.write(f'Sending test password-reset email to {recipient} ...')
        send_password_reset_email(recipient, 'https://example.com/reset-password/test-token')
        self.stdout.write(self.style.SUCCESS('  Password-reset email dispatched.'))

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. Check {recipient} inbox — both emails should arrive within a few seconds.'
        ))
