import pytest
from datetime import date, timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.users.models import EmailVerificationCode, Follow, RoleChoices, User, UserProfile


@pytest.mark.django_db
class TestUserManager:
    def test_create_user_sets_fields_correctly(self):
        user = User.objects.create_user(
            email='user@example.com',
            username='testuser',
            password='Password1',
        )
        assert user.email == 'user@example.com'
        assert user.username == 'testuser'
        assert user.role == RoleChoices.REGISTERED_USER
        assert user.is_active is False
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
class TestUserNewFields:
    """Tests for is_username_public and total_points added to User."""

    def setup_method(self):
        self.user = User.objects.create_user(
            email='user@example.com',
            username='testuser',
            password='Password1',
        )

    def test_is_username_public_defaults_to_true(self):
        assert self.user.is_username_public is True

    def test_is_username_public_can_be_set_false(self):
        self.user.is_username_public = False
        self.user.save()
        self.user.refresh_from_db()
        assert self.user.is_username_public is False

    def test_total_points_defaults_to_zero(self):
        assert self.user.total_points == 0

    def test_total_points_persists_large_value(self):
        self.user.total_points = 999999
        self.user.save()
        self.user.refresh_from_db()
        assert self.user.total_points == 999999

    def test_total_points_can_store_negative_value(self):
        # Point deductions must not be blocked by a PositiveIntegerField constraint
        self.user.total_points = -10
        self.user.save()
        self.user.refresh_from_db()
        assert self.user.total_points == -10


@pytest.mark.django_db
class TestUserProfile:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='profile@example.com',
            username='profileuser',
            password='Password1',
        )

    def test_profile_can_be_created_for_user(self):
        profile = UserProfile.objects.create(user=self.user)
        assert profile.pk is not None

    def test_privacy_flags_default_to_true(self):
        profile = UserProfile.objects.create(user=self.user)
        assert profile.is_name_public is True
        assert profile.is_location_public is True
        assert profile.is_birth_date_public is True
        assert profile.is_photo_public is True

    def test_optional_text_fields_default_to_blank(self):
        profile = UserProfile.objects.create(user=self.user)
        assert profile.first_name == ''
        assert profile.last_name == ''
        assert profile.location == ''
        assert profile.bio == ''

    def test_first_name_and_last_name_store_correctly(self):
        profile = UserProfile.objects.create(
            user=self.user, first_name='Ada', last_name='Lovelace'
        )
        profile.refresh_from_db()
        assert profile.first_name == 'Ada'
        assert profile.last_name == 'Lovelace'

    def test_is_name_public_can_be_set_false(self):
        profile = UserProfile.objects.create(user=self.user, is_name_public=False)
        profile.refresh_from_db()
        assert profile.is_name_public is False

    def test_optional_nullable_fields_default_to_none(self):
        profile = UserProfile.objects.create(user=self.user)
        assert profile.birth_date is None
        assert not profile.profile_photo  # FileField is falsy when blank

    def test_birth_date_stores_and_retrieves_correctly(self):
        profile = UserProfile.objects.create(
            user=self.user,
            birth_date=date(1990, 6, 15),
        )
        profile.refresh_from_db()
        assert profile.birth_date == date(1990, 6, 15)

    def test_profile_str_contains_username(self):
        profile = UserProfile.objects.create(user=self.user)
        assert 'profileuser' in str(profile)

    def test_profile_is_deleted_when_user_is_deleted(self):
        # on_delete=CASCADE: UserProfile must be removed with its User row
        profile = UserProfile.objects.create(user=self.user)
        profile_pk = profile.pk
        self.user.delete()
        assert not UserProfile.objects.filter(pk=profile_pk).exists()

    def test_one_user_cannot_have_two_profiles(self):
        # OneToOneField enforces a DB-level unique constraint
        UserProfile.objects.create(user=self.user)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                UserProfile.objects.create(user=self.user)

    def test_profile_privacy_flags_can_be_toggled(self):
        profile = UserProfile.objects.create(user=self.user)
        profile.is_location_public = False
        profile.is_birth_date_public = False
        profile.save()
        profile.refresh_from_db()
        assert profile.is_location_public is False
        assert profile.is_birth_date_public is False


@pytest.mark.django_db
class TestEmailVerificationCode:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='user@example.com',
            username='testuser',
            password='Password1',
        )

    def test_generate_code_returns_six_digits(self):
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


# ── Follow model ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestFollowModel:
    def setup_method(self):
        self.user1 = User.objects.create_user(
            email='m1@example.com', username='muser1', password='Password1'
        )
        self.user2 = User.objects.create_user(
            email='m2@example.com', username='muser2', password='Password1'
        )

    def test_follow_can_be_created(self):
        follow = Follow.objects.create(follower=self.user1, followed=self.user2)
        assert follow.pk is not None
        assert follow.created_at is not None

    def test_str_representation(self):
        follow = Follow.objects.create(follower=self.user1, followed=self.user2)
        assert str(follow) == f'Follow({self.user1.pk} → {self.user2.pk})'

    def test_unique_constraint_prevents_duplicate(self):
        Follow.objects.create(follower=self.user1, followed=self.user2)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Follow.objects.create(follower=self.user1, followed=self.user2)

    def test_deleting_follower_cascades(self):
        Follow.objects.create(follower=self.user1, followed=self.user2)
        self.user1.delete()
        assert not Follow.objects.filter(followed=self.user2).exists()

    def test_deleting_followed_cascades(self):
        Follow.objects.create(follower=self.user1, followed=self.user2)
        self.user2.delete()
        assert not Follow.objects.filter(follower=self.user1).exists()
