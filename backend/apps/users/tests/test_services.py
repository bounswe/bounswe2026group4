import pytest
from rest_framework.exceptions import AuthenticationFailed, ValidationError

from apps.users.models import EmailVerificationCode, User
from apps.users.services import login_user, logout_user, register_user


@pytest.mark.django_db
class TestRegisterUser:
    def _data(self, **overrides):
        data = {
            'email': 'user@example.com',
            'username': 'testuser',
            'password': 'Password1',
            'password_confirmation': 'Password1',
        }
        data.update(overrides)
        return data

    def test_creates_user(self):
        user = register_user(self._data())
        assert User.objects.filter(email='user@example.com').exists()
        assert user.username == 'testuser'

    def test_password_is_hashed(self):
        user = register_user(self._data())
        assert user.check_password('Password1') is True
        assert user.password != 'Password1'

    def test_creates_verification_code(self):
        user = register_user(self._data())
        assert EmailVerificationCode.objects.filter(user=user).exists()

    def test_user_is_active_on_registration(self):
        # Active by default until email verification is enforced (req. 1.2.1.2 stub)
        user = register_user(self._data())
        assert user.is_active is True

    def test_email_is_not_verified_on_registration(self):
        user = register_user(self._data())
        assert user.is_email_verified is False


@pytest.mark.django_db
class TestLoginUser:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='user@example.com',
            username='testuser',
            password='Password1',
        )

    def test_returns_tokens_on_valid_credentials(self):
        result = login_user('user@example.com', 'Password1')
        assert 'access' in result
        assert 'refresh' in result

    def test_returns_user_info(self):
        result = login_user('user@example.com', 'Password1')
        assert result['user']['email'] == 'user@example.com'
        assert result['user']['username'] == 'testuser'

    def test_wrong_password_raises_auth_failed(self):
        with pytest.raises(AuthenticationFailed):
            login_user('user@example.com', 'WrongPassword1')

    def test_wrong_email_raises_auth_failed(self):
        with pytest.raises(AuthenticationFailed):
            login_user('nobody@example.com', 'Password1')

    def test_wrong_email_and_wrong_password_same_error(self):
        # Both cases must return identical errors to prevent user enumeration (req. 1.2.1.10)
        try:
            login_user('nobody@example.com', 'Password1')
        except AuthenticationFailed as e:
            wrong_email_msg = str(e.detail)

        try:
            login_user('user@example.com', 'WrongPassword1')
        except AuthenticationFailed as e:
            wrong_password_msg = str(e.detail)

        assert wrong_email_msg == wrong_password_msg

    def test_inactive_user_cannot_login(self):
        self.user.is_active = False
        self.user.save()
        with pytest.raises(AuthenticationFailed):
            login_user('user@example.com', 'Password1')


@pytest.mark.django_db
class TestLogoutUser:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='user@example.com',
            username='testuser',
            password='Password1',
        )

    def test_valid_refresh_token_is_blacklisted(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = str(RefreshToken.for_user(self.user))
        # Should not raise
        logout_user(refresh)

    def test_blacklisted_token_raises_validation_error(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = str(RefreshToken.for_user(self.user))
        logout_user(refresh)
        # Second logout with same token must fail
        with pytest.raises(ValidationError):
            logout_user(refresh)

    def test_invalid_token_raises_validation_error(self):
        with pytest.raises(ValidationError):
            logout_user('this-is-not-a-valid-token')
