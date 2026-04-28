import pytest
from django.core import mail

from apps.users.email_service import send_password_reset_email, send_verification_email


@pytest.mark.django_db
class TestSendVerificationEmail:
    def test_sends_to_recipient(self):
        send_verification_email('user@example.com', '123456')
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['user@example.com']

    def test_body_contains_code(self):
        send_verification_email('user@example.com', '123456')
        assert '123456' in mail.outbox[0].body

    def test_subject_mentions_verify(self):
        send_verification_email('user@example.com', '123456')
        assert 'verify' in mail.outbox[0].subject.lower()

    def test_failure_does_not_propagate(self, monkeypatch):
        monkeypatch.setattr(
            'apps.users.email_service.send_mail',
            lambda *args, **kwargs: (_ for _ in ()).throw(Exception('SMTP down')),
        )
        # must not raise
        send_verification_email('user@example.com', '123456')


@pytest.mark.django_db
class TestSendPasswordResetEmail:
    def test_sends_to_recipient(self):
        send_password_reset_email('user@example.com', 'http://app.example.com/reset/abc')
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['user@example.com']

    def test_body_contains_reset_link(self):
        send_password_reset_email('user@example.com', 'http://app.example.com/reset/abc')
        assert 'http://app.example.com/reset/abc' in mail.outbox[0].body

    def test_subject_mentions_password(self):
        send_password_reset_email('user@example.com', 'http://app.example.com/reset/abc')
        assert 'password' in mail.outbox[0].subject.lower()

    def test_failure_does_not_propagate(self, monkeypatch):
        monkeypatch.setattr(
            'apps.users.email_service.send_mail',
            lambda *args, **kwargs: (_ for _ in ()).throw(Exception('SMTP down')),
        )
        send_password_reset_email('user@example.com', 'http://app.example.com/reset/abc')
