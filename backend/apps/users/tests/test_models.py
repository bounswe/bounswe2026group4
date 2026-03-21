import pytest
from datetime import timedelta

from django.utils import timezone

from apps.users.models import EmailVerificationCode, RoleChoices, User


@pytest.mark.django_db
class TestUserManager:
    def test_create_user_sets_fields_correctly(self):
        # Verify all default field values match what the spec requires on registration
        user = User.objects.create_user(
            email='user@example.com',
            username='testuser',
            password='Password1',
        )
        assert user.email == 'user@example.com'
        assert user.username == 'testuser'
        assert user.role == RoleChoices.REGISTERED_USER
        assert user.is_active is True
        assert user.is_staff is False
        assert user.is_superuser is False
        assert user.is_email_verified is False

    def test_create_user_hashes_password(self):
        user = User.objects.create_user(
            email='user@example.com',
            username='testuser',
            password='Password1',
        )
        assert user.check_password('Password1') is True
        assert user.password != 'Password1'  # plaintext must never be stored

    def test_create_user_normalizes_email(self):
        # Only the domain part is lowercased — local part case is preserved
        user = User.objects.create_user(
            email='User@EXAMPLE.COM',
            username='testuser',
            password='Password1',
        )
        assert user.email == 'User@example.com'

    def test_create_user_requires_email(self):
        with pytest.raises(ValueError, match='Email is required'):
            User.objects.create_user(email='', username='testuser', password='Password1')

    def test_create_user_requires_username(self):
        with pytest.raises(ValueError, match='Username is required'):
            User.objects.create_user(email='user@example.com', username='', password='Password1')

    def test_create_superuser_sets_admin_fields(self):
        # Superusers skip email verification and are immediately active
        superuser = User.objects.create_superuser(
            email='admin@example.com',
            username='admin',
            password='Password1',
        )
        assert superuser.role == RoleChoices.ADMIN
        assert superuser.is_staff is True
        assert superuser.is_superuser is True
        assert superuser.is_active is True
        assert superuser.is_email_verified is True

    def test_email_must_be_unique(self):
        User.objects.create_user(email='user@example.com', username='user1', password='Password1')
        with pytest.raises(Exception):
            User.objects.create_user(email='user@example.com', username='user2', password='Password1')

    def test_username_must_be_unique(self):
        User.objects.create_user(email='user1@example.com', username='sameuser', password='Password1')
        with pytest.raises(Exception):
            User.objects.create_user(email='user2@example.com', username='sameuser', password='Password1')


@pytest.mark.django_db
class TestEmailVerificationCode:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='user@example.com',
            username='testuser',
            password='Password1',
        )

    def test_generate_code_returns_six_digits(self):
        # Spec requires a 6-digit code (req. 1.2.1.2)
        code = EmailVerificationCode.generate_code()
        assert len(code) == 6
        assert code.isdigit()

    def test_code_is_not_expired_when_fresh(self):
        verification = EmailVerificationCode.objects.create(
            user=self.user,
            code=EmailVerificationCode.generate_code(),
        )
        assert verification.is_expired() is False

    def test_code_is_expired_when_past_expiry(self):
        # Simulate an already-expired code by setting expires_at in the past
        verification = EmailVerificationCode.objects.create(
            user=self.user,
            code=EmailVerificationCode.generate_code(),
            expires_at=timezone.now() - timedelta(seconds=1),
        )
        assert verification.is_expired() is True

    def test_code_defaults_to_unused(self):
        verification = EmailVerificationCode.objects.create(
            user=self.user,
            code=EmailVerificationCode.generate_code(),
        )
        assert verification.is_used is False

    def test_code_is_linked_to_user(self):
        EmailVerificationCode.objects.create(
            user=self.user,
            code=EmailVerificationCode.generate_code(),
        )
        assert self.user.verification_codes.count() == 1

    def test_str_representation(self):
        verification = EmailVerificationCode.objects.create(
            user=self.user,
            code='123456',
        )
        assert 'user@example.com' in str(verification)
        assert '123456' in str(verification)
