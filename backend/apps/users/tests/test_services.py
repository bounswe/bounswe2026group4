from decimal import Decimal

import pytest
from django.http import Http404
from rest_framework.exceptions import AuthenticationFailed, ValidationError

from apps.users.models import EmailVerificationCode, User, UserProfile
from apps.users.services import get_own_profile, get_public_profile, login_user, logout_user, register_user, update_own_profile
from apps.stories.models import Story


@pytest.mark.django_db
class TestRegisterUser:
    def _data(self, **overrides):
        data = {
            'email': 'user@example.com',
            'username': 'testuser',
            'password': 'Password1',
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
        # Active by default — email verification is scaffolded but not yet enforced
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
        # Both failure modes must return identical errors to prevent user enumeration
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

    def test_inactive_user_gets_same_error_as_invalid_credentials(self):
        # An inactive (banned/disabled) account must be indistinguishable from a non-existent one
        self.user.is_active = False
        self.user.save()
        try:
            login_user('nobody@example.com', 'Password1')
        except AuthenticationFailed as e:
            nonexistent_msg = str(e.detail)

        try:
            login_user('user@example.com', 'Password1')
        except AuthenticationFailed as e:
            inactive_msg = str(e.detail)

        assert nonexistent_msg == inactive_msg


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


# ── get_public_profile ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestGetPublicProfile:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='profile@example.com',
            username='profileuser',
            password='Password1',
        )

    def test_returns_user_for_valid_id(self):
        result = get_public_profile(self.user.pk)
        assert result.pk == self.user.pk

    def test_raises_404_for_nonexistent_user(self):
        with pytest.raises(Http404):
            get_public_profile(99999)

    def test_annotates_published_story_count(self):
        Story.objects.create(
            user=self.user, title='Pub', narrative='N',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2000,
        )
        Story.objects.create(
            user=self.user, title='Draft', narrative='N',
            status=Story.STATUS_DRAFT,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2001,
        )
        result = get_public_profile(self.user.pk)
        assert result.published_story_count == 1

    def test_zero_published_stories(self):
        result = get_public_profile(self.user.pk)
        assert result.published_story_count == 0

    def test_profile_is_prefetched(self):
        from apps.users.models import UserProfile
        UserProfile.objects.create(user=self.user, bio='Historian')
        result = get_public_profile(self.user.pk)
        # select_related means profile is accessible without an extra query
        assert result.profile.bio == 'Historian'

    def test_inactive_user_raises_404(self):
        self.user.is_active = False
        self.user.save()
        with pytest.raises(Http404):
            get_public_profile(self.user.pk)


# ── get_own_profile ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestGetOwnProfile:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='own@example.com',
            username='ownuser',
            password='Password1',
        )

    def test_returns_correct_user(self):
        result = get_own_profile(self.user)
        assert result.pk == self.user.pk

    def test_creates_profile_when_not_exists(self):
        assert not UserProfile.objects.filter(user=self.user).exists()
        get_own_profile(self.user)
        assert UserProfile.objects.filter(user=self.user).exists()

    def test_profile_accessible_via_relation(self):
        result = get_own_profile(self.user)
        # select_related means profile is loaded without an extra query
        assert result.profile is not None

    def test_idempotent_when_profile_already_exists(self):
        UserProfile.objects.create(user=self.user, bio='Existing')
        result = get_own_profile(self.user)
        assert result.profile.bio == 'Existing'
        assert UserProfile.objects.filter(user=self.user).count() == 1


# ── update_own_profile ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUpdateOwnProfile:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='upd@example.com',
            username='upduser',
            password='Password1',
        )

    def test_updates_user_fields(self):
        result = update_own_profile(self.user, {'username': 'newname'}, {})
        assert result.username == 'newname'
        self.user.refresh_from_db()
        assert self.user.username == 'newname'

    def test_updates_is_username_public(self):
        result = update_own_profile(self.user, {'is_username_public': False}, {})
        assert result.is_username_public is False

    def test_updates_profile_fields(self):
        result = update_own_profile(self.user, {}, {'bio': 'Historian', 'location': 'Istanbul'})
        assert result.profile.bio == 'Historian'
        assert result.profile.location == 'Istanbul'

    def test_creates_profile_when_not_exists_on_profile_update(self):
        assert not UserProfile.objects.filter(user=self.user).exists()
        update_own_profile(self.user, {}, {'bio': 'New bio'})
        assert UserProfile.objects.filter(user=self.user).exists()

    def test_updates_both_user_and_profile_fields(self):
        result = update_own_profile(
            self.user,
            {'username': 'combined'},
            {'bio': 'Both updated'},
        )
        assert result.username == 'combined'
        assert result.profile.bio == 'Both updated'

    def test_returns_user_with_profile_prefetched(self):
        result = update_own_profile(self.user, {}, {'location': 'Ankara'})
        assert result.profile.location == 'Ankara'

    def test_empty_fields_returns_user_unchanged(self):
        result = update_own_profile(self.user, {}, {})
        assert result.pk == self.user.pk
        assert result.username == 'upduser'

    def test_does_not_create_profile_when_profile_fields_empty(self):
        # Profile row should only be created when there is actual profile data to save
        update_own_profile(self.user, {'is_username_public': False}, {})
        assert not UserProfile.objects.filter(user=self.user).exists()

    def test_persists_profile_privacy_flags(self):
        update_own_profile(self.user, {}, {'is_location_public': False, 'is_birth_date_public': False})
        profile = UserProfile.objects.get(user=self.user)
        assert profile.is_location_public is False
        assert profile.is_birth_date_public is False
