import datetime
from decimal import Decimal

import pytest
from django.db.models import Value

from apps.users.models import User, UserProfile
from apps.users.serializers import LoginSerializer, PublicUserProfileSerializer, RegisterSerializer
from apps.stories.models import Story


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


# ── PublicUserProfileSerializer ───────────────────────────────────────────────

@pytest.mark.django_db
class TestPublicUserProfileSerializer:
    def _make_user(self, **kwargs):
        defaults = dict(email='prof@example.com', username='profuser', password='Password1')
        defaults.update(kwargs)
        return User.objects.create_user(**defaults)

    def _serialize(self, user, request=None):
        from apps.users.services import get_public_profile
        annotated = get_public_profile(user.pk)
        return PublicUserProfileSerializer(
            annotated, context={'request': request}
        ).data

    def test_contains_required_fields(self):
        user = self._make_user()
        data = self._serialize(user)
        for field in ['id', 'username', 'total_points', 'date_joined', 'published_story_count']:
            assert field in data

    def test_username_visible_when_public(self):
        user = self._make_user()
        user.is_username_public = True
        user.save()
        data = self._serialize(user)
        assert data['username'] == user.username

    def test_username_hidden_when_private(self):
        user = self._make_user()
        user.is_username_public = False
        user.save()
        data = self._serialize(user)
        assert data['username'] is None

    def test_published_story_count_is_correct(self):
        user = self._make_user()
        Story.objects.create(
            user=user, title='Pub', narrative='N',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2000,
        )
        Story.objects.create(
            user=user, title='Draft', narrative='N',
            status=Story.STATUS_DRAFT,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2001,
        )
        data = self._serialize(user)
        assert data['published_story_count'] == 1

    def test_location_visible_when_flag_true(self):
        user = self._make_user()
        UserProfile.objects.create(user=user, location='Ankara', is_location_public=True)
        data = self._serialize(user)
        assert data['location'] == 'Ankara'

    def test_location_hidden_when_flag_false(self):
        user = self._make_user()
        UserProfile.objects.create(user=user, location='Ankara', is_location_public=False)
        data = self._serialize(user)
        assert data['location'] is None

    def test_bio_always_returned_when_profile_exists(self):
        user = self._make_user()
        UserProfile.objects.create(user=user, bio='Historian')
        data = self._serialize(user)
        assert data['bio'] == 'Historian'

    def test_birth_year_hidden_when_flag_false(self):
        user = self._make_user()
        UserProfile.objects.create(
            user=user,
            birth_date=datetime.date(1990, 5, 20),
            is_birth_date_public=False,
        )
        data = self._serialize(user)
        assert data['birth_year'] is None

    def test_birth_year_returns_integer_year_only(self):
        # Req. 1.2.3.1: public profile exposes birth *year* only, not full date
        user = self._make_user()
        UserProfile.objects.create(
            user=user,
            birth_date=datetime.date(1990, 5, 20),
            is_birth_date_public=True,
        )
        data = self._serialize(user)
        assert data['birth_year'] == 1990
        assert isinstance(data['birth_year'], int)

    def test_no_profile_returns_null_for_optional_fields(self):
        user = self._make_user()
        data = self._serialize(user)
        assert data['profile_photo'] is None
        assert data['location'] is None
        assert data['bio'] is None
        assert data['birth_year'] is None
