import logging

import pytest
from django.apps import apps
from django.test import override_settings


def _run_email_check():
    apps.get_app_config('users')._warn_if_email_misconfigured()


def _run_frontend_url_check():
    apps.get_app_config('users')._warn_if_frontend_url_misconfigured()


class TestEmailMisconfigurationWarning:
    # ── SMTP backend ────────────────────────────────────────────────────────

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend',
        EMAIL_HOST_PASSWORD='',
        DEFAULT_FROM_EMAIL='Sender <noreply@verified.com>',
    )
    def test_smtp_warns_when_password_missing(self, caplog):
        with caplog.at_level(logging.WARNING, logger='apps.users.apps'):
            _run_email_check()
        assert 'EMAIL_HOST_PASSWORD' in caplog.text

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend',
        EMAIL_HOST_PASSWORD='secret',
        DEFAULT_FROM_EMAIL='Sender <noreply@verified.com>',
    )
    def test_smtp_no_warning_when_password_set(self, caplog):
        with caplog.at_level(logging.WARNING, logger='apps.users.apps'):
            _run_email_check()
        assert 'EMAIL_HOST_PASSWORD' not in caplog.text

    # ── Resend HTTP backend ─────────────────────────────────────────────────
    # ResendEmailBackend is introduced by fix/email-verification-delivery.
    # Django never imports the backend class during these checks, so the
    # module does not need to exist — only the string 'resend' is matched.

    @override_settings(
        EMAIL_BACKEND='common.email_backend.ResendEmailBackend',
        RESEND_API_KEY='',
        DEFAULT_FROM_EMAIL='Sender <noreply@verified.com>',
    )
    def test_resend_warns_when_api_key_missing(self, caplog):
        with caplog.at_level(logging.WARNING, logger='apps.users.apps'):
            _run_email_check()
        assert 'RESEND_API_KEY' in caplog.text

    @override_settings(
        EMAIL_BACKEND='common.email_backend.ResendEmailBackend',
        RESEND_API_KEY='re_abc123',
        DEFAULT_FROM_EMAIL='Sender <noreply@verified.com>',
    )
    def test_resend_no_warning_when_api_key_set(self, caplog):
        with caplog.at_level(logging.WARNING, logger='apps.users.apps'):
            _run_email_check()
        assert 'RESEND_API_KEY' not in caplog.text

    # ── DEFAULT_FROM_EMAIL placeholder ──────────────────────────────────────

    @override_settings(
        EMAIL_BACKEND='common.email_backend.ResendEmailBackend',
        RESEND_API_KEY='re_abc123',
        DEFAULT_FROM_EMAIL='App <noreply@example.com>',
    )
    def test_warns_on_example_com_sender_resend(self, caplog):
        with caplog.at_level(logging.WARNING, logger='apps.users.apps'):
            _run_email_check()
        assert 'DEFAULT_FROM_EMAIL' in caplog.text

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend',
        EMAIL_HOST_PASSWORD='secret',
        DEFAULT_FROM_EMAIL='App <noreply@example.com>',
    )
    def test_warns_on_example_com_sender_smtp(self, caplog):
        with caplog.at_level(logging.WARNING, logger='apps.users.apps'):
            _run_email_check()
        assert 'DEFAULT_FROM_EMAIL' in caplog.text

    # ── Dev backends are skipped ────────────────────────────────────────────

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.console.EmailBackend',
        DEFAULT_FROM_EMAIL='App <noreply@example.com>',
    )
    def test_console_backend_skips_all_warnings(self, caplog):
        with caplog.at_level(logging.WARNING, logger='apps.users.apps'):
            _run_email_check()
        assert caplog.text == ''


class TestFrontendUrlWarning:
    @override_settings(DEBUG=False, FRONTEND_URL='http://localhost:3000')
    def test_warns_when_localhost_in_production(self, caplog):
        with caplog.at_level(logging.WARNING, logger='apps.users.apps'):
            _run_frontend_url_check()
        assert 'FRONTEND_URL' in caplog.text
        assert 'localhost' in caplog.text

    @override_settings(DEBUG=False, FRONTEND_URL='http://127.0.0.1:3000')
    def test_warns_when_loopback_ip_in_production(self, caplog):
        with caplog.at_level(logging.WARNING, logger='apps.users.apps'):
            _run_frontend_url_check()
        assert 'FRONTEND_URL' in caplog.text

    @override_settings(DEBUG=False, FRONTEND_URL='https://storymap.page')
    def test_no_warning_for_production_url(self, caplog):
        with caplog.at_level(logging.WARNING, logger='apps.users.apps'):
            _run_frontend_url_check()
        assert 'FRONTEND_URL' not in caplog.text

    @override_settings(DEBUG=False, FRONTEND_URL='')
    def test_warns_when_frontend_url_is_empty(self, caplog):
        with caplog.at_level(logging.WARNING, logger='apps.users.apps'):
            _run_frontend_url_check()
        assert 'FRONTEND_URL' in caplog.text

    @override_settings(DEBUG=True, FRONTEND_URL='http://localhost:3000')
    def test_no_warning_in_debug_mode(self, caplog):
        with caplog.at_level(logging.WARNING, logger='apps.users.apps'):
            _run_frontend_url_check()
        assert 'FRONTEND_URL' not in caplog.text
