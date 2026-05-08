import pytest
from unittest.mock import MagicMock, patch
from django.core.mail import EmailMessage

from common.email_backend import ResendEmailBackend


RESEND_API_URL = 'https://api.resend.com/emails'
FAKE_API_KEY = 're_test_key_123'


def _make_message(to=None, subject='Hello', body='World', from_email='noreply@example.com'):
    return EmailMessage(
        subject=subject,
        body=body,
        from_email=from_email,
        to=to or ['recipient@example.com'],
    )


def _ok_response():
    mock = MagicMock()
    mock.raise_for_status.return_value = None
    return mock


def _error_response():
    from requests import HTTPError
    mock = MagicMock()
    mock.raise_for_status.side_effect = HTTPError(response=mock)
    return mock


@pytest.fixture()
def with_api_key(settings):
    settings.RESEND_API_KEY = FAKE_API_KEY


@pytest.fixture()
def without_api_key(settings):
    settings.RESEND_API_KEY = ''


class TestResendEmailBackendSuccess:
    def test_returns_one_for_successful_send(self, with_api_key):
        with patch('common.email_backend.requests.post', return_value=_ok_response()):
            sent = ResendEmailBackend().send_messages([_make_message()])
        assert sent == 1

    def test_posts_to_resend_api_url(self, with_api_key):
        with patch('common.email_backend.requests.post', return_value=_ok_response()) as mock_post:
            ResendEmailBackend().send_messages([_make_message()])
        assert mock_post.call_args[0][0] == RESEND_API_URL

    def test_sends_bearer_token_in_authorization_header(self, with_api_key):
        with patch('common.email_backend.requests.post', return_value=_ok_response()) as mock_post:
            ResendEmailBackend().send_messages([_make_message()])
        headers = mock_post.call_args[1]['headers']
        assert headers['Authorization'] == f'Bearer {FAKE_API_KEY}'

    def test_payload_contains_correct_fields(self, with_api_key):
        msg = _make_message(
            to=['alice@example.com', 'bob@example.com'],
            subject='Verify your email',
            body='Your code is 123456',
            from_email='noreply@storymap.page',
        )
        with patch('common.email_backend.requests.post', return_value=_ok_response()) as mock_post:
            ResendEmailBackend().send_messages([msg])
        payload = mock_post.call_args[1]['json']
        assert payload['from'] == 'noreply@storymap.page'
        assert payload['to'] == ['alice@example.com', 'bob@example.com']
        assert payload['subject'] == 'Verify your email'
        assert payload['text'] == 'Your code is 123456'

    def test_returns_count_equal_to_number_of_messages_sent(self, with_api_key):
        with patch('common.email_backend.requests.post', return_value=_ok_response()):
            sent = ResendEmailBackend().send_messages([_make_message(), _make_message(), _make_message()])
        assert sent == 3

    def test_returns_zero_for_empty_message_list(self, with_api_key):
        with patch('common.email_backend.requests.post') as mock_post:
            sent = ResendEmailBackend().send_messages([])
        assert sent == 0
        mock_post.assert_not_called()


class TestResendEmailBackendFailure:
    def test_raises_on_api_error_by_default(self, with_api_key):
        from requests import HTTPError
        with patch('common.email_backend.requests.post', return_value=_error_response()):
            with pytest.raises(HTTPError):
                ResendEmailBackend().send_messages([_make_message()])

    def test_fail_silently_suppresses_http_error(self, with_api_key):
        with patch('common.email_backend.requests.post', return_value=_error_response()):
            sent = ResendEmailBackend(fail_silently=True).send_messages([_make_message()])
        assert sent == 0

    def test_fail_silently_suppresses_connection_error(self, with_api_key):
        from requests import ConnectionError as RequestsConnectionError
        with patch('common.email_backend.requests.post', side_effect=RequestsConnectionError('unreachable')):
            sent = ResendEmailBackend(fail_silently=True).send_messages([_make_message()])
        assert sent == 0

    def test_raises_connection_error_when_not_silent(self, with_api_key):
        from requests import ConnectionError as RequestsConnectionError
        with patch('common.email_backend.requests.post', side_effect=RequestsConnectionError('unreachable')):
            with pytest.raises(RequestsConnectionError):
                ResendEmailBackend().send_messages([_make_message()])


class TestResendEmailBackendMissingKey:
    def test_raises_value_error_when_api_key_is_empty(self, without_api_key):
        with pytest.raises(ValueError, match='RESEND_API_KEY'):
            ResendEmailBackend().send_messages([_make_message()])

    def test_fail_silently_returns_zero_when_api_key_missing(self, without_api_key):
        sent = ResendEmailBackend(fail_silently=True).send_messages([_make_message()])
        assert sent == 0
