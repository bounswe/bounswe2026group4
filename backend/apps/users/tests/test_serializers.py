import pytest

from apps.users.models import User
from apps.users.serializers import LoginSerializer, RegisterSerializer


@pytest.mark.django_db
class TestRegisterSerializer:
    def _valid_data(self, **overrides):
        data = {
            'email': 'user@example.com',
            'username': 'testuser',
            'password': 'Password1',
            'password_confirmation': 'Password1',
        }
        data.update(overrides)
        return data

    def test_valid_data_passes(self):
        serializer = RegisterSerializer(data=self._valid_data())
        assert serializer.is_valid(), serializer.errors

    def test_email_is_lowercased(self):
        serializer = RegisterSerializer(data=self._valid_data(email='User@EXAMPLE.COM'))
        assert serializer.is_valid()
        assert serializer.validated_data['email'] == 'user@example.com'

    def test_duplicate_email_fails(self):
        User.objects.create_user(email='user@example.com', username='existing', password='Password1')
        serializer = RegisterSerializer(data=self._valid_data())
        assert not serializer.is_valid()
        assert 'email' in serializer.errors

    def test_duplicate_username_fails(self):
        User.objects.create_user(email='other@example.com', username='testuser', password='Password1')
        serializer = RegisterSerializer(data=self._valid_data())
        assert not serializer.is_valid()
        assert 'username' in serializer.errors

    def test_passwords_must_match(self):
        serializer = RegisterSerializer(data=self._valid_data(password_confirmation='Different1'))
        assert not serializer.is_valid()
        assert 'password_confirmation' in serializer.errors

    def test_short_password_fails(self):
        serializer = RegisterSerializer(data=self._valid_data(password='Ab1', password_confirmation='Ab1'))
        assert not serializer.is_valid()
        assert 'password' in serializer.errors

    def test_password_without_digit_fails(self):
        serializer = RegisterSerializer(data=self._valid_data(password='Password', password_confirmation='Password'))
        assert not serializer.is_valid()
        assert 'password' in serializer.errors

    def test_password_without_uppercase_fails(self):
        serializer = RegisterSerializer(data=self._valid_data(password='password1', password_confirmation='password1'))
        assert not serializer.is_valid()
        assert 'password' in serializer.errors

    def test_password_without_lowercase_fails(self):
        serializer = RegisterSerializer(data=self._valid_data(password='PASSWORD1', password_confirmation='PASSWORD1'))
        assert not serializer.is_valid()
        assert 'password' in serializer.errors

    def test_username_too_short_fails(self):
        serializer = RegisterSerializer(data=self._valid_data(username='ab'))
        assert not serializer.is_valid()
        assert 'username' in serializer.errors

    def test_invalid_email_format_fails(self):
        serializer = RegisterSerializer(data=self._valid_data(email='not-an-email'))
        assert not serializer.is_valid()
        assert 'email' in serializer.errors

    def test_password_is_write_only(self):
        # password must never appear in serializer output
        serializer = RegisterSerializer(data=self._valid_data())
        serializer.is_valid()
        assert 'password' not in serializer.data
        assert 'password_confirmation' not in serializer.data


class TestLoginSerializer:
    def test_valid_data_passes(self):
        serializer = LoginSerializer(data={'email': 'user@example.com', 'password': 'Password1'})
        assert serializer.is_valid(), serializer.errors

    def test_missing_email_fails(self):
        serializer = LoginSerializer(data={'password': 'Password1'})
        assert not serializer.is_valid()
        assert 'email' in serializer.errors

    def test_missing_password_fails(self):
        serializer = LoginSerializer(data={'email': 'user@example.com'})
        assert not serializer.is_valid()
        assert 'password' in serializer.errors

    def test_password_is_write_only(self):
        serializer = LoginSerializer(data={'email': 'user@example.com', 'password': 'Password1'})
        serializer.is_valid()
        assert 'password' not in serializer.data
