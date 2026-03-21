import pytest
from unittest.mock import MagicMock

from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated, PermissionDenied, ValidationError
from rest_framework.response import Response

from common.exceptions import custom_exception_handler


def make_context():
    return {'request': MagicMock(), 'view': MagicMock()}


class TestCustomExceptionHandler:
    def test_validation_error_single_field(self):
        exc = ValidationError({'email': ['This field is required.']})
        response = custom_exception_handler(exc, make_context())

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data['success'] is False
        assert response.data['message'] == 'This field is required.'
        assert 'email' in response.data['errors']

    def test_validation_error_multiple_fields(self):
        exc = ValidationError({
            'email': ['Enter a valid email address.'],
            'password': ['This field is required.'],
        })
        response = custom_exception_handler(exc, make_context())

        assert response.data['success'] is False
        assert 'errors' in response.data
        assert 'email' in response.data['errors']
        assert 'password' in response.data['errors']

    def test_validation_error_multiple_messages_on_one_field(self):
        exc = ValidationError({'password': ['Too short.', 'Must contain a number.']})
        response = custom_exception_handler(exc, make_context())

        # Top-level message surfaces only the first error
        assert response.data['message'] == 'Too short.'

    def test_auth_error_uses_detail(self):
        exc = NotAuthenticated()
        response = custom_exception_handler(exc, make_context())

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data['success'] is False
        assert response.data['message'] != ''
        assert response.data['errors'] == {}

    def test_permission_denied_uses_detail(self):
        exc = PermissionDenied()
        response = custom_exception_handler(exc, make_context())

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.data['success'] is False

    def test_non_field_errors_as_list(self):
        exc = ValidationError(['Passwords do not match.'])
        response = custom_exception_handler(exc, make_context())

        assert response.data['success'] is False
        assert response.data['message'] == 'Passwords do not match.'
        assert 'non_field_errors' in response.data['errors']

    def test_non_drf_exception_returns_none(self):
        # Non-DRF exceptions should not be handled here
        exc = ValueError('something broke')
        response = custom_exception_handler(exc, make_context())
        assert response is None
