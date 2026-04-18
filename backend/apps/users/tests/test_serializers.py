import datetime
import io
from decimal import Decimal

import pytest
from django.core.files.base import ContentFile
from django.db.models import Value
from PIL import Image
from rest_framework.test import APIRequestFactory

from apps.users.models import User, UserProfile
from apps.users.serializers import (
    CurrentUserSerializer,
    LoginSerializer,
    ProfilePhotoSerializer,
    PublicUserProfileSerializer,
    RegisterSerializer,
    UpdateCurrentUserSerializer,
)
from apps.stories.models import Story


def _jpeg_content():
    """Return raw JPEG bytes for attaching to a profile_photo field in tests."""
    buf = io.BytesIO()
    Image.new('RGB', (10, 10), color=(100, 149, 237)).save(buf, format='JPEG')
    buf.seek(0)
    return buf.read()


def _make_request():
    return APIRequestFactory().get('/')


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

    def test_profile_photo_returns_absolute_url_when_public(self):
        user = self._make_user()
        profile = UserProfile.objects.create(user=user, is_photo_public=True)
        profile.profile_photo.save('pub.jpg', ContentFile(_jpeg_content()), save=True)
        data = self._serialize(user, request=_make_request())
        assert data['profile_photo'] is not None
        assert data['profile_photo'].startswith('http')

    def test_profile_photo_hidden_when_is_photo_public_false(self):
        user = self._make_user()
        profile = UserProfile.objects.create(user=user, is_photo_public=False)
        profile.profile_photo.save('priv.jpg', ContentFile(_jpeg_content()), save=True)
        data = self._serialize(user, request=_make_request())
        assert data['profile_photo'] is None


# ── CurrentUserSerializer ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCurrentUserSerializer:
    def _make_user(self, **kwargs):
        defaults = dict(email='me@example.com', username='meuser', password='Password1')
        defaults.update(kwargs)
        return User.objects.create_user(**defaults)

    def test_contains_all_expected_fields(self):
        user = self._make_user()
        data = CurrentUserSerializer(user).data
        for field in ['id', 'email', 'username', 'role', 'is_username_public',
                      'is_email_verified', 'date_joined', 'total_points', 'profile']:
            assert field in data

    def test_field_values_match_user(self):
        user = self._make_user()
        data = CurrentUserSerializer(user).data
        assert data['email'] == 'me@example.com'
        assert data['username'] == 'meuser'
        assert data['role'] == 'registered_user'

    def test_profile_is_none_when_no_profile_exists(self):
        user = self._make_user()
        data = CurrentUserSerializer(user).data
        assert data['profile'] is None

    def test_profile_nested_when_profile_exists(self):
        user = self._make_user()
        UserProfile.objects.create(user=user, location='Istanbul', bio='Historian')
        data = CurrentUserSerializer(user).data
        assert data['profile'] is not None
        assert data['profile']['location'] == 'Istanbul'
        assert data['profile']['bio'] == 'Historian'

    def test_profile_returns_all_privacy_flags_to_owner(self):
        # Owner always sees privacy flags regardless of their value (no visibility filtering)
        user = self._make_user()
        UserProfile.objects.create(user=user, is_location_public=False, is_birth_date_public=False)
        data = CurrentUserSerializer(user).data
        assert data['profile']['is_location_public'] is False
        assert data['profile']['is_birth_date_public'] is False

    def test_profile_birth_date_returned_as_full_date_not_year_only(self):
        # Unlike the public profile, the owner sees the full birth_date, not just the year
        user = self._make_user()
        UserProfile.objects.create(user=user, birth_date=datetime.date(1990, 5, 20))
        data = CurrentUserSerializer(user).data
        assert data['profile']['birth_date'] == '1990-05-20'

    def test_profile_photo_none_when_not_set(self):
        user = self._make_user()
        UserProfile.objects.create(user=user)
        data = CurrentUserSerializer(user).data
        assert data['profile']['profile_photo'] is None

    def test_profile_photo_returns_absolute_url_with_request_context(self):
        user = self._make_user()
        profile = UserProfile.objects.create(user=user)
        profile.profile_photo.save('owner.jpg', ContentFile(_jpeg_content()), save=True)
        data = CurrentUserSerializer(user, context={'request': _make_request()}).data
        url = data['profile']['profile_photo']
        assert url is not None
        assert url.startswith('http')


# ── UpdateCurrentUserSerializer ───────────────────────────────────────────────

@pytest.mark.django_db
class TestUpdateCurrentUserSerializer:
    def _make_user(self, **kwargs):
        defaults = dict(email='upd@example.com', username='upduser', password='Password1')
        defaults.update(kwargs)
        return User.objects.create_user(**defaults)

    def _make_request(self, user):
        from unittest.mock import Mock
        req = Mock()
        req.user = user
        return req

    def test_valid_new_username_passes(self):
        user = self._make_user()
        serializer = UpdateCurrentUserSerializer(
            data={'username': 'newname'}, context={'request': self._make_request(user)}
        )
        assert serializer.is_valid(), serializer.errors

    def test_same_username_as_own_passes(self):
        user = self._make_user()
        serializer = UpdateCurrentUserSerializer(
            data={'username': user.username}, context={'request': self._make_request(user)}
        )
        assert serializer.is_valid(), serializer.errors

    def test_duplicate_username_from_other_user_fails(self):
        user = self._make_user()
        User.objects.create_user(email='other@example.com', username='takenname', password='Password1')
        serializer = UpdateCurrentUserSerializer(
            data={'username': 'takenname'}, context={'request': self._make_request(user)}
        )
        assert not serializer.is_valid()
        assert 'username' in serializer.errors

    def test_username_too_short_fails(self):
        user = self._make_user()
        serializer = UpdateCurrentUserSerializer(
            data={'username': 'ab'}, context={'request': self._make_request(user)}
        )
        assert not serializer.is_valid()
        assert 'username' in serializer.errors

    def test_empty_data_passes(self):
        user = self._make_user()
        serializer = UpdateCurrentUserSerializer(
            data={}, context={'request': self._make_request(user)}
        )
        assert serializer.is_valid(), serializer.errors

    def test_profile_only_passes(self):
        user = self._make_user()
        serializer = UpdateCurrentUserSerializer(
            data={'profile': {'bio': 'Bio text', 'location': 'Ankara'}},
            context={'request': self._make_request(user)},
        )
        assert serializer.is_valid(), serializer.errors

    def test_split_validated_data_separates_user_and_profile_fields(self):
        user = self._make_user()
        serializer = UpdateCurrentUserSerializer(
            data={
                'username': 'newname',
                'is_username_public': False,
                'profile': {'bio': 'A historian', 'location': 'Ankara'},
            },
            context={'request': self._make_request(user)},
        )
        assert serializer.is_valid(), serializer.errors
        user_fields, profile_fields = serializer.split_validated_data()
        assert user_fields == {'username': 'newname', 'is_username_public': False}
        assert profile_fields == {'bio': 'A historian', 'location': 'Ankara'}

    def test_split_validated_data_empty_profile_when_not_provided(self):
        user = self._make_user()
        serializer = UpdateCurrentUserSerializer(
            data={'username': 'newname'}, context={'request': self._make_request(user)}
        )
        serializer.is_valid()
        user_fields, profile_fields = serializer.split_validated_data()
        assert 'username' in user_fields
        assert profile_fields == {}

    def test_protected_fields_are_silently_ignored(self):
        # System-managed fields sent in the request body must not appear in validated_data
        user = self._make_user()
        serializer = UpdateCurrentUserSerializer(
            data={'email': 'hacked@example.com', 'role': 'admin', 'total_points': 9999},
            context={'request': self._make_request(user)},
        )
        assert serializer.is_valid(), serializer.errors
        user_fields, profile_fields = serializer.split_validated_data()
        assert 'email' not in user_fields
        assert 'role' not in user_fields
        assert 'total_points' not in user_fields


# ── ProfilePhotoSerializer ────────────────────────────────────────────────────

class TestProfilePhotoSerializer:
    def _jpeg_file(self):
        from django.core.files.uploadedfile import InMemoryUploadedFile
        buf = io.BytesIO()
        Image.new('RGB', (10, 10), color=(100, 149, 237)).save(buf, format='JPEG')
        buf.seek(0)
        return InMemoryUploadedFile(buf, 'photo', 'test.jpg', 'image/jpeg', buf.getbuffer().nbytes, None)

    def _png_file(self):
        from django.core.files.uploadedfile import InMemoryUploadedFile
        buf = io.BytesIO()
        Image.new('RGB', (10, 10), color=(100, 149, 237)).save(buf, format='PNG')
        buf.seek(0)
        return InMemoryUploadedFile(buf, 'photo', 'test.png', 'image/png', buf.getbuffer().nbytes, None)

    def test_valid_jpeg_passes(self):
        serializer = ProfilePhotoSerializer(data={'photo': self._jpeg_file()})
        assert serializer.is_valid(), serializer.errors

    def test_valid_png_passes(self):
        serializer = ProfilePhotoSerializer(data={'photo': self._png_file()})
        assert serializer.is_valid(), serializer.errors

    def test_missing_file_fails(self):
        serializer = ProfilePhotoSerializer(data={})
        assert not serializer.is_valid()
        assert 'photo' in serializer.errors

    def test_non_image_file_fails(self):
        from django.core.files.uploadedfile import InMemoryUploadedFile
        buf = io.BytesIO(b'this is not an image')
        file = InMemoryUploadedFile(buf, 'photo', 'file.txt', 'text/plain', buf.getbuffer().nbytes, None)
        serializer = ProfilePhotoSerializer(data={'photo': file})
        assert not serializer.is_valid()
        assert 'photo' in serializer.errors
