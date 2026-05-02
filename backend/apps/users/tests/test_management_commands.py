import pytest
from django.core import mail
from django.core.management import call_command
from django.core.management.base import CommandError
from io import StringIO


@pytest.mark.django_db
class TestSendTestEmailCommand:
    def test_sends_both_emails(self):
        call_command('send_test_email', 'smoke@example.com', stdout=StringIO())
        assert len(mail.outbox) == 2

    def test_emails_sent_to_recipient(self):
        call_command('send_test_email', 'smoke@example.com', stdout=StringIO())
        recipients = [msg.to for msg in mail.outbox]
        assert ['smoke@example.com'] in recipients
        assert recipients.count(['smoke@example.com']) == 2

    def test_verification_email_contains_code(self):
        call_command('send_test_email', 'smoke@example.com', stdout=StringIO())
        bodies = ' '.join(msg.body for msg in mail.outbox)
        assert '123456' in bodies

    def test_reset_email_contains_link(self):
        call_command('send_test_email', 'smoke@example.com', stdout=StringIO())
        bodies = ' '.join(msg.body for msg in mail.outbox)
        assert 'reset-password' in bodies

    def test_raises_command_error_on_verification_email_failure(self, monkeypatch):
        monkeypatch.setattr(
            'apps.users.management.commands.send_test_email.send_verification_email',
            lambda *args, **kwargs: (_ for _ in ()).throw(Exception('SMTP down')),
        )
        with pytest.raises(CommandError, match='Verification email failed'):
            call_command('send_test_email', 'smoke@example.com', stdout=StringIO())

    def test_raises_command_error_on_reset_email_failure(self, monkeypatch):
        monkeypatch.setattr(
            'apps.users.management.commands.send_test_email.send_password_reset_email',
            lambda *args, **kwargs: (_ for _ in ()).throw(Exception('SMTP down')),
        )
        with pytest.raises(CommandError, match='Password-reset email failed'):
            call_command('send_test_email', 'smoke@example.com', stdout=StringIO())
