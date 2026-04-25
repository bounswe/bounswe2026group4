import datetime
import io
import os
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from apps.interactions.models import SavedStory
from apps.stories.models import Story
from apps.users.models import Follow, User


def _make_image_file(fmt='JPEG'):
    buf = io.BytesIO()
    Image.new('RGB', (10, 10), color=(100, 149, 237)).save(buf, format=fmt)
    buf.seek(0)
    ext = 'jpg' if fmt == 'JPEG' else fmt.lower()
    content_type = 'image/jpeg' if fmt == 'JPEG' else f'image/{fmt.lower()}'
    return InMemoryUploadedFile(buf, 'photo', f'test.{ext}', content_type, buf.getbuffer().nbytes, None)


def _make_gif_file():
    """GIF is a valid image Pillow accepts but our MIME whitelist rejects."""
    buf = io.BytesIO()
    Image.new('P', (10, 10), 0).save(buf, format='GIF')
    buf.seek(0)
    return InMemoryUploadedFile(buf, 'photo', 'test.gif', 'image/gif', buf.getbuffer().nbytes, None)


def _make_oversized_png_file():
    """Real PNG > 2 MB: random pixels at compress_level=0 prevent compression."""
    raw = os.urandom(3 * 900 * 900)
    img = Image.frombytes('RGB', (900, 900), raw)
    buf = io.BytesIO()
    img.save(buf, format='PNG', compress_level=0)
    buf.seek(0)
    return InMemoryUploadedFile(buf, 'photo', 'big.png', 'image/png', buf.getbuffer().nbytes, None)


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def registered_user(db):
    return User.objects.create_user(
        email='user@example.com',
        username='testuser',
        password='Password1',
    )


@pytest.fixture
def auth_client(client, registered_user):
    """Returns an APIClient with a valid access token and the refresh token."""
    response = client.post('/auth/login/', {
        'email': 'user@example.com',
        'password': 'Password1',
    })
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')
    client.refresh_token = response.data['refresh']
    return client


@pytest.mark.django_db
class TestRegisterView:
    def test_register_success(self, client):
        response = client.post('/auth/register/', {
            'email': 'new@example.com',
            'username': 'newuser',
            'password': 'Password1',
            'password_confirmation': 'Password1',
        })
        assert response.status_code == status.HTTP_201_CREATED
        assert 'user' in response.data
        assert response.data['user']['email'] == 'new@example.com'

    def test_register_creates_user_in_db(self, client):
        client.post('/auth/register/', {
            'email': 'new@example.com',
            'username': 'newuser',
            'password': 'Password1',
            'password_confirmation': 'Password1',
        })
        assert User.objects.filter(email='new@example.com').exists()

    def test_register_duplicate_email_returns_400(self, client, registered_user):
        response = client.post('/auth/register/', {
            'email': 'user@example.com',
            'username': 'anotheruser',
            'password': 'Password1',
            'password_confirmation': 'Password1',
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'email' in response.data['errors']

    def test_register_weak_password_returns_400(self, client):
        response = client.post('/auth/register/', {
            'email': 'new@example.com',
            'username': 'newuser',
            'password': 'weak',
            'password_confirmation': 'weak',
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'password' in response.data['errors']

    def test_register_mismatched_passwords_returns_400(self, client):
        response = client.post('/auth/register/', {
            'email': 'new@example.com',
            'username': 'newuser',
            'password': 'Password1',
            'password_confirmation': 'Password2',
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_response_does_not_contain_password(self, client):
        response = client.post('/auth/register/', {
            'email': 'new@example.com',
            'username': 'newuser',
            'password': 'Password1',
            'password_confirmation': 'Password1',
        })
        assert 'password' not in response.data.get('user', {})


@pytest.mark.django_db
class TestLoginView:
    def test_login_success_returns_tokens(self, client, registered_user):
        response = client.post('/auth/login/', {
            'email': 'user@example.com',
            'password': 'Password1',
        })
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data

    def test_login_returns_user_info(self, client, registered_user):
        response = client.post('/auth/login/', {
            'email': 'user@example.com',
            'password': 'Password1',
        })
        assert response.data['user']['email'] == 'user@example.com'

    def test_login_wrong_password_returns_401(self, client, registered_user):
        response = client.post('/auth/login/', {
            'email': 'user@example.com',
            'password': 'WrongPassword1',
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_wrong_email_returns_401(self, client):
        response = client.post('/auth/login/', {
            'email': 'nobody@example.com',
            'password': 'Password1',
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_wrong_email_and_wrong_password_same_message(self, client, registered_user):
        # Both failure cases must surface an identical message to prevent user enumeration
        r1 = client.post('/auth/login/', {'email': 'nobody@example.com', 'password': 'Password1'})
        r2 = client.post('/auth/login/', {'email': 'user@example.com', 'password': 'WrongPassword1'})
        assert r1.data['message'] == r2.data['message']

    def test_response_does_not_contain_password(self, client, registered_user):
        response = client.post('/auth/login/', {
            'email': 'user@example.com',
            'password': 'Password1',
        })
        assert 'password' not in response.data.get('user', {})

    def test_login_rate_limit_returns_429_after_limit(self, client):
        from django.core.cache import cache
        from unittest.mock import patch
        cache.clear()
        # Patch get_rate directly: override_settings doesn't reliably flush DRF's
        # api_settings cache in all test-suite orderings.
        with patch('rest_framework.throttling.ScopedRateThrottle.get_rate', return_value='10/minute'):
            for _ in range(10):
                client.post('/auth/login/', {'email': 'x@example.com', 'password': 'wrong'})
            response = client.post('/auth/login/', {'email': 'x@example.com', 'password': 'wrong'})
        cache.clear()
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS


@pytest.mark.django_db
class TestLogoutView:
    def test_logout_success_returns_204(self, auth_client):
        response = auth_client.post('/auth/logout/', {'refresh': auth_client.refresh_token})
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_logout_without_auth_returns_401(self, client):
        # Unauthenticated requests must be rejected
        response = client.post('/auth/logout/', {'refresh': 'sometoken'})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout_blacklisted_token_returns_400(self, auth_client):
        # Using the same refresh token twice must fail
        auth_client.post('/auth/logout/', {'refresh': auth_client.refresh_token})
        response = auth_client.post('/auth/logout/', {'refresh': auth_client.refresh_token})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestTokenRefreshView:
    url = '/auth/token/refresh/'

    def test_refresh_returns_new_access_token(self, client, registered_user):
        login = client.post('/auth/login/', {
            'email': 'user@example.com',
            'password': 'Password1',
        })
        response = client.post(self.url, {'refresh': login.data['refresh']})
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data

    def test_refresh_with_invalid_token_fails(self, client):
        response = client.post(self.url, {'refresh': 'invalid-token'})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_with_blacklisted_token_fails(self, auth_client):
        # Logout blacklists the refresh token; it should no longer be usable
        refresh = auth_client.refresh_token
        auth_client.post('/auth/logout/', {'refresh': refresh})
        response = auth_client.post(self.url, {'refresh': refresh})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_rotates_refresh_token(self, client, registered_user):
        # ROTATE_REFRESH_TOKENS is True, so a new refresh token must be returned
        login = client.post('/auth/login/', {
            'email': 'user@example.com',
            'password': 'Password1',
        })
        response = client.post(self.url, {'refresh': login.data['refresh']})
        assert response.status_code == status.HTTP_200_OK
        assert 'refresh' in response.data
        assert response.data['refresh'] != login.data['refresh']


# ── GET /users/<user_id>/ ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUserPublicProfileView:
    url = '/users/{user_id}/'

    def test_returns_200_for_existing_user(self, client, registered_user):
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.status_code == status.HTTP_200_OK

    def test_returns_404_for_nonexistent_user(self, client):
        response = client.get(self.url.format(user_id=99999))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_accessible_without_authentication(self, client, registered_user):
        # Public endpoint — no token required
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.status_code == status.HTTP_200_OK

    def test_response_contains_expected_fields(self, client, registered_user):
        response = client.get(self.url.format(user_id=registered_user.pk))
        for field in ['id', 'username', 'total_points', 'date_joined', 'published_story_count']:
            assert field in response.data

    def test_username_visible_when_public(self, client, registered_user):
        registered_user.is_username_public = True
        registered_user.save()
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['username'] == registered_user.username

    def test_username_hidden_when_private(self, client, registered_user):
        registered_user.is_username_public = False
        registered_user.save()
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['username'] is None

    def test_published_story_count_reflects_published_stories(self, client, registered_user):
        from decimal import Decimal
        from apps.stories.models import Story

        Story.objects.create(
            user=registered_user, title='Pub', narrative='n',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('41.0'), location_lng=Decimal('29.0'),
            location_name='Istanbul', time_type=Story.TIME_EXACT, year=2000,
        )
        Story.objects.create(
            user=registered_user, title='Draft', narrative='n',
            status=Story.STATUS_DRAFT,
            location_lat=Decimal('41.0'), location_lng=Decimal('29.0'),
            location_name='Istanbul', time_type=Story.TIME_EXACT, year=2001,
        )
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['published_story_count'] == 1

    def test_profile_photo_hidden_when_flag_false(self, client, registered_user):
        from apps.users.models import UserProfile
        UserProfile.objects.create(user=registered_user, is_photo_public=False)
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['profile_photo'] is None

    def test_location_hidden_when_flag_false(self, client, registered_user):
        from apps.users.models import UserProfile
        UserProfile.objects.create(
            user=registered_user, location='Istanbul', is_location_public=False
        )
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['location'] is None

    def test_location_visible_when_flag_true(self, client, registered_user):
        from apps.users.models import UserProfile
        UserProfile.objects.create(
            user=registered_user, location='Istanbul', is_location_public=True
        )
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['location'] == 'Istanbul'

    def test_bio_always_returned_when_profile_exists(self, client, registered_user):
        from apps.users.models import UserProfile
        UserProfile.objects.create(user=registered_user, bio='A historian.')
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['bio'] == 'A historian.'

    def test_birth_year_hidden_when_flag_false(self, client, registered_user):
        from apps.users.models import UserProfile
        UserProfile.objects.create(
            user=registered_user,
            birth_date=datetime.date(1990, 1, 1),
            is_birth_date_public=False,
        )
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['birth_year'] is None

    def test_birth_year_returns_integer_year_only(self, client, registered_user):
        # Req. 1.2.3.1: public profile exposes birth *year* only, not full date
        from apps.users.models import UserProfile
        UserProfile.objects.create(
            user=registered_user,
            birth_date=datetime.date(1990, 5, 20),
            is_birth_date_public=True,
        )
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['birth_year'] == 1990
        assert isinstance(response.data['birth_year'], int)

    def test_inactive_user_returns_404(self, client, registered_user):
        registered_user.is_active = False
        registered_user.save()
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_no_profile_returns_null_for_optional_fields(self, client, registered_user):
        # User with no UserProfile row
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['profile_photo'] is None
        assert response.data['location'] is None
        assert response.data['bio'] is None
        assert response.data['birth_year'] is None

    def test_name_visible_when_is_name_public_true(self, client, registered_user):
        from apps.users.models import UserProfile
        UserProfile.objects.create(
            user=registered_user, first_name='Ada', last_name='Lovelace', is_name_public=True
        )
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['first_name'] == 'Ada'
        assert response.data['last_name'] == 'Lovelace'

    def test_name_hidden_when_is_name_public_false(self, client, registered_user):
        from apps.users.models import UserProfile
        UserProfile.objects.create(
            user=registered_user, first_name='Ada', last_name='Lovelace', is_name_public=False
        )
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['first_name'] is None
        assert response.data['last_name'] is None

    def test_name_null_when_no_profile(self, client, registered_user):
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['first_name'] is None
        assert response.data['last_name'] is None


# ── GET /users/me/ and PATCH /users/me/ ──────────────────────────────────────

@pytest.mark.django_db
class TestCurrentUserView:
    url = '/users/me/'

    # ── GET ──────────────────────────────────────────────────────────────────

    def test_get_unauthenticated_returns_401(self, client):
        response = client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_authenticated_returns_200(self, auth_client):
        response = auth_client.get(self.url)
        assert response.status_code == status.HTTP_200_OK

    def test_get_response_has_success_and_data_envelope(self, auth_client):
        response = auth_client.get(self.url)
        assert response.data['success'] is True
        assert 'data' in response.data

    def test_get_response_contains_expected_fields(self, auth_client):
        response = auth_client.get(self.url)
        data = response.data['data']
        for field in ['id', 'email', 'username', 'role', 'is_username_public',
                      'is_email_verified', 'date_joined', 'total_points', 'profile']:
            assert field in data

    def test_get_returns_private_fields_to_owner(self, auth_client, registered_user):
        # Owner sees email and privacy flags — fields that are hidden on the public endpoint
        response = auth_client.get(self.url)
        data = response.data['data']
        assert data['email'] == registered_user.email
        assert 'is_username_public' in data

    def test_get_creates_profile_if_not_exists(self, auth_client, registered_user):
        from apps.users.models import UserProfile
        assert not UserProfile.objects.filter(user=registered_user).exists()
        auth_client.get(self.url)
        assert UserProfile.objects.filter(user=registered_user).exists()

    def test_get_profile_nested_when_profile_exists(self, auth_client, registered_user):
        from apps.users.models import UserProfile
        UserProfile.objects.create(user=registered_user, bio='Historian', location='Istanbul')
        response = auth_client.get(self.url)
        profile = response.data['data']['profile']
        assert profile['bio'] == 'Historian'
        assert profile['location'] == 'Istanbul'

    def test_get_profile_includes_all_privacy_flags(self, auth_client, registered_user):
        from apps.users.models import UserProfile
        UserProfile.objects.create(user=registered_user, is_location_public=False)
        response = auth_client.get(self.url)
        profile = response.data['data']['profile']
        # Owner always receives their own privacy flags regardless of value
        assert profile['is_location_public'] is False

    # ── PATCH ────────────────────────────────────────────────────────────────

    def test_patch_unauthenticated_returns_401(self, client):
        response = client.patch(self.url, {'username': 'newname'}, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_patch_username_returns_200(self, auth_client):
        response = auth_client.patch(self.url, {'username': 'brandnew'}, format='json')
        assert response.status_code == status.HTTP_200_OK

    def test_patch_username_updates_in_db(self, auth_client, registered_user):
        auth_client.patch(self.url, {'username': 'brandnew'}, format='json')
        registered_user.refresh_from_db()
        assert registered_user.username == 'brandnew'

    def test_patch_response_contains_updated_username(self, auth_client):
        response = auth_client.patch(self.url, {'username': 'brandnew'}, format='json')
        assert response.data['data']['username'] == 'brandnew'

    def test_patch_profile_fields_returns_200(self, auth_client):
        response = auth_client.patch(
            self.url,
            {'profile': {'bio': 'A historian', 'location': 'Ankara'}},
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK

    def test_patch_profile_fields_updates_in_db(self, auth_client, registered_user):
        from apps.users.models import UserProfile
        auth_client.patch(
            self.url,
            {'profile': {'bio': 'A historian', 'location': 'Ankara'}},
            format='json',
        )
        profile = UserProfile.objects.get(user=registered_user)
        assert profile.bio == 'A historian'
        assert profile.location == 'Ankara'

    def test_patch_creates_profile_when_not_exists(self, auth_client, registered_user):
        from apps.users.models import UserProfile
        assert not UserProfile.objects.filter(user=registered_user).exists()
        auth_client.patch(self.url, {'profile': {'bio': 'New'}}, format='json')
        assert UserProfile.objects.filter(user=registered_user).exists()

    def test_patch_protected_fields_are_ignored(self, auth_client, registered_user):
        response = auth_client.patch(
            self.url,
            {'email': 'hacked@example.com', 'role': 'admin'},
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK
        registered_user.refresh_from_db()
        assert registered_user.email == 'user@example.com'
        assert registered_user.role == 'registered_user'

    def test_patch_duplicate_username_returns_400(self, auth_client):
        User.objects.create_user(
            email='other@example.com', username='takenname', password='Password1'
        )
        response = auth_client.patch(self.url, {'username': 'takenname'}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_patch_empty_body_returns_200(self, auth_client):
        response = auth_client.patch(self.url, {}, format='json')
        assert response.status_code == status.HTTP_200_OK

    def test_patch_response_has_success_and_data_envelope(self, auth_client):
        response = auth_client.patch(self.url, {'is_username_public': False}, format='json')
        assert response.data['success'] is True
        assert 'data' in response.data

    def test_patch_profile_photo_is_ignored(self, auth_client, registered_user):
        # profile_photo must be uploaded via POST /users/me/photo/ only;
        # PATCH silently ignores it rather than storing an unvalidated file
        response = auth_client.patch(
            self.url,
            {'profile_photo': _make_image_file('JPEG')},
            format='multipart',
        )
        assert response.status_code == status.HTTP_200_OK
        from apps.users.models import UserProfile
        profile = UserProfile.objects.filter(user=registered_user).first()
        assert profile is None or not profile.profile_photo

    def test_patch_name_fields_updates_in_db(self, auth_client, registered_user):
        from apps.users.models import UserProfile
        response = auth_client.patch(
            self.url,
            {'profile': {'first_name': 'Ada', 'last_name': 'Lovelace'}},
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK
        profile = UserProfile.objects.get(user=registered_user)
        assert profile.first_name == 'Ada'
        assert profile.last_name == 'Lovelace'

    def test_patch_is_name_public_updates_in_db(self, auth_client, registered_user):
        from apps.users.models import UserProfile
        response = auth_client.patch(
            self.url,
            {'profile': {'is_name_public': False}},
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK
        profile = UserProfile.objects.get(user=registered_user)
        assert profile.is_name_public is False

    def test_get_profile_includes_name_fields_for_owner(self, auth_client, registered_user):
        from apps.users.models import UserProfile
        UserProfile.objects.create(
            user=registered_user, first_name='Ada', last_name='Lovelace', is_name_public=False
        )
        response = auth_client.get(self.url)
        profile = response.data['data']['profile']
        # Owner always sees their own name even when is_name_public is False
        assert profile['first_name'] == 'Ada'
        assert profile['last_name'] == 'Lovelace'
        assert profile['is_name_public'] is False


# ── POST /users/me/photo/ and DELETE /users/me/photo/ ─────────────────────────

@pytest.mark.django_db
class TestProfilePhotoView:
    url = '/users/me/photo/'

    # ── POST ─────────────────────────────────────────────────────────────────

    def test_upload_jpeg_returns_200(self, auth_client):
        response = auth_client.post(self.url, {'photo': _make_image_file('JPEG')}, format='multipart')
        assert response.status_code == status.HTTP_200_OK

    def test_upload_png_returns_200(self, auth_client):
        response = auth_client.post(self.url, {'photo': _make_image_file('PNG')}, format='multipart')
        assert response.status_code == status.HTTP_200_OK

    def test_upload_response_contains_photo_url(self, auth_client):
        response = auth_client.post(self.url, {'photo': _make_image_file('JPEG')}, format='multipart')
        assert response.data['success'] is True
        assert 'photo_url' in response.data
        assert response.data['photo_url'] is not None

    def test_upload_photo_url_is_absolute(self, auth_client):
        response = auth_client.post(self.url, {'photo': _make_image_file('JPEG')}, format='multipart')
        assert response.data['photo_url'].startswith('http')

    def test_upload_saves_photo_to_profile(self, auth_client, registered_user):
        auth_client.post(self.url, {'photo': _make_image_file('JPEG')}, format='multipart')
        from apps.users.models import UserProfile
        assert UserProfile.objects.get(user=registered_user).profile_photo

    def test_upload_unsupported_mime_type_returns_400(self, auth_client):
        response = auth_client.post(self.url, {'photo': _make_gif_file()}, format='multipart')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_unsupported_mime_type_error_references_photo_field(self, auth_client):
        response = auth_client.post(self.url, {'photo': _make_gif_file()}, format='multipart')
        assert 'photo' in response.data['errors']

    def test_upload_oversized_file_returns_400(self, auth_client):
        response = auth_client.post(self.url, {'photo': _make_oversized_png_file()}, format='multipart')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_oversized_file_error_references_photo_field(self, auth_client):
        response = auth_client.post(self.url, {'photo': _make_oversized_png_file()}, format='multipart')
        assert 'photo' in response.data['errors']

    def test_upload_without_file_returns_400(self, auth_client):
        response = auth_client.post(self.url, {}, format='multipart')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_unauthenticated_returns_401(self, client):
        response = client.post(self.url, {'photo': _make_image_file('JPEG')}, format='multipart')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    # ── DELETE ───────────────────────────────────────────────────────────────

    def test_delete_after_upload_returns_204(self, auth_client):
        auth_client.post(self.url, {'photo': _make_image_file('JPEG')}, format='multipart')
        response = auth_client.delete(self.url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_delete_clears_photo_field(self, auth_client, registered_user):
        auth_client.post(self.url, {'photo': _make_image_file('JPEG')}, format='multipart')
        auth_client.delete(self.url)
        from apps.users.models import UserProfile
        assert not UserProfile.objects.get(user=registered_user).profile_photo

    def test_delete_when_no_photo_returns_204(self, auth_client):
        response = auth_client.delete(self.url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_delete_unauthenticated_returns_401(self, client):
        response = client.delete(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    # ── is_photo_public toggle ────────────────────────────────────────────────

    def test_photo_hidden_on_public_profile_after_toggling_flag_off(self, auth_client, registered_user, client):
        auth_client.post(self.url, {'photo': _make_image_file('JPEG')}, format='multipart')
        auth_client.patch('/users/me/', {'profile': {'is_photo_public': False}}, format='json')
        response = client.get(f'/users/{registered_user.pk}/')
        assert response.data['profile_photo'] is None

    def test_photo_visible_on_public_profile_after_toggling_flag_back_on(self, auth_client, registered_user, client):
        auth_client.post(self.url, {'photo': _make_image_file('JPEG')}, format='multipart')
        auth_client.patch('/users/me/', {'profile': {'is_photo_public': False}}, format='json')
        auth_client.patch('/users/me/', {'profile': {'is_photo_public': True}}, format='json')
        response = client.get(f'/users/{registered_user.pk}/')
        assert response.data['profile_photo'] is not None
        assert response.data['profile_photo'].startswith('http')


# ── DELETE /users/me/ ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDeleteAccountView:
    url = '/users/me/'

    def _make_story(self, user):
        return Story.objects.create(
            user=user,
            title='My Story',
            narrative='Narrative',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('41.0'),
            location_lng=Decimal('29.0'),
            location_name='Istanbul',
            time_type=Story.TIME_EXACT,
            year=2000,
        )

    def test_delete_unauthenticated_returns_401(self, client):
        response = client.delete(self.url, {'password': 'Password1'}, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_hard_delete_returns_204(self, auth_client):
        response = auth_client.delete(self.url, {'password': 'Password1'}, format='json')
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_hard_delete_removes_user_from_db(self, auth_client, registered_user):
        auth_client.delete(self.url, {'password': 'Password1'}, format='json')
        assert not User.objects.filter(pk=registered_user.pk).exists()

    def test_hard_delete_removes_stories(self, auth_client, registered_user):
        story = self._make_story(registered_user)
        auth_client.delete(self.url, {'password': 'Password1'}, format='json')
        assert not Story.objects.filter(pk=story.pk).exists()

    def test_soft_delete_returns_204(self, auth_client):
        response = auth_client.delete(
            self.url, {'password': 'Password1', 'hard_delete': False}, format='json'
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_soft_delete_deactivates_user(self, auth_client, registered_user):
        auth_client.delete(
            self.url, {'password': 'Password1', 'hard_delete': False}, format='json'
        )
        assert User.objects.get(pk=registered_user.pk).is_active is False

    def test_soft_delete_anonymizes_stories(self, auth_client, registered_user):
        story = self._make_story(registered_user)
        auth_client.delete(
            self.url, {'password': 'Password1', 'hard_delete': False}, format='json'
        )
        assert Story.objects.get(pk=story.pk).user is None

    def test_with_refresh_token_blacklists_it(self, auth_client):
        refresh = auth_client.refresh_token
        auth_client.delete(
            self.url,
            {'password': 'Password1', 'refresh': refresh},
            format='json',
        )
        response = auth_client.post('/auth/token/refresh/', {'refresh': refresh})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_without_refresh_token_still_returns_204(self, auth_client):
        response = auth_client.delete(self.url, {'password': 'Password1'}, format='json')
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_wrong_password_returns_400(self, auth_client):
        response = auth_client.delete(self.url, {'password': 'WrongPassword'}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_wrong_password_error_references_password_field(self, auth_client):
        response = auth_client.delete(self.url, {'password': 'WrongPassword'}, format='json')
        assert 'password' in response.data['errors']

    def test_missing_password_returns_400(self, auth_client):
        response = auth_client.delete(self.url, {}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── POST/DELETE /users/:id/follow/ ───────────────────────────────────────────


@pytest.mark.django_db
class TestFollowView:
    url = '/users/{user_id}/follow/'

    def test_first_follow_returns_201(self, auth_client, second_user):
        response = auth_client.post(self.url.format(user_id=second_user.pk))
        assert response.status_code == status.HTTP_201_CREATED

    def test_first_follow_response_shape(self, auth_client, second_user):
        response = auth_client.post(self.url.format(user_id=second_user.pk))
        assert response.data['success'] is True
        for field in ('follower_id', 'followed_id', 'created_at'):
            assert field in response.data['data']

    def test_refollow_returns_200(self, auth_client, second_user):
        auth_client.post(self.url.format(user_id=second_user.pk))
        response = auth_client.post(self.url.format(user_id=second_user.pk))
        assert response.status_code == status.HTTP_200_OK

    def test_self_follow_returns_400(self, auth_client, registered_user):
        response = auth_client.post(self.url.format(user_id=registered_user.pk))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_post_returns_401(self, client, second_user):
        response = client.post(self.url.format(user_id=second_user.pk))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_post_unknown_user_returns_404(self, auth_client):
        response = auth_client.post(self.url.format(user_id=99999))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_unfollow_returns_204(self, auth_client, second_user):
        auth_client.post(self.url.format(user_id=second_user.pk))
        response = auth_client.delete(self.url.format(user_id=second_user.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_unfollow_idempotent_returns_204(self, auth_client, second_user):
        response = auth_client.delete(self.url.format(user_id=second_user.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_unauthenticated_delete_returns_401(self, client, second_user):
        response = client.delete(self.url.format(user_id=second_user.pk))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_delete_unknown_user_returns_404(self, auth_client):
        response = auth_client.delete(self.url.format(user_id=99999))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── GET /users/:id/followers/ ────────────────────────────────────────────────


@pytest.mark.django_db
class TestFollowerListView:
    url = '/users/{user_id}/followers/'

    def test_unauthenticated_returns_200(self, client, registered_user):
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.status_code == status.HTTP_200_OK

    def test_unknown_user_returns_404(self, client):
        response = client.get(self.url.format(user_id=99999))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_inactive_user_returns_404(self, client, registered_user):
        registered_user.is_active = False
        registered_user.save()
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_response_is_paginated(self, client, registered_user):
        response = client.get(self.url.format(user_id=registered_user.pk))
        for key in ('count', 'results'):
            assert key in response.data

    def test_lists_correct_followers(self, client, registered_user, second_user):
        Follow.objects.create(follower=second_user, followed=registered_user)
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['count'] == 1
        assert response.data['results'][0]['id'] == second_user.pk

    def test_non_follower_not_in_list(self, client, registered_user):
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['count'] == 0

    def test_inactive_follower_excluded_from_list(self, client, registered_user, second_user):
        Follow.objects.create(follower=second_user, followed=registered_user)
        second_user.is_active = False
        second_user.save()
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['count'] == 0

    def test_result_contains_expected_fields(self, client, registered_user, second_user):
        Follow.objects.create(follower=second_user, followed=registered_user)
        response = client.get(self.url.format(user_id=registered_user.pk))
        entry = response.data['results'][0]
        for field in ('id', 'username', 'profile_photo'):
            assert field in entry


# ── GET /users/:id/following/ ────────────────────────────────────────────────


@pytest.mark.django_db
class TestFollowingListView:
    url = '/users/{user_id}/following/'

    def test_unauthenticated_returns_200(self, client, registered_user):
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.status_code == status.HTTP_200_OK

    def test_unknown_user_returns_404(self, client):
        response = client.get(self.url.format(user_id=99999))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_inactive_user_returns_404(self, client, registered_user):
        registered_user.is_active = False
        registered_user.save()
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_response_is_paginated(self, client, registered_user):
        response = client.get(self.url.format(user_id=registered_user.pk))
        for key in ('count', 'results'):
            assert key in response.data

    def test_lists_correct_following(self, client, registered_user, second_user):
        Follow.objects.create(follower=registered_user, followed=second_user)
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['count'] == 1
        assert response.data['results'][0]['id'] == second_user.pk

    def test_not_following_returns_empty(self, client, registered_user):
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['count'] == 0

    def test_inactive_following_excluded_from_list(self, client, registered_user, second_user):
        Follow.objects.create(follower=registered_user, followed=second_user)
        second_user.is_active = False
        second_user.save()
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['count'] == 0

    def test_result_contains_expected_fields(self, client, registered_user, second_user):
        Follow.objects.create(follower=registered_user, followed=second_user)
        response = client.get(self.url.format(user_id=registered_user.pk))
        entry = response.data['results'][0]
        for field in ('id', 'username', 'profile_photo'):
            assert field in entry


# ── /users/:id/ public profile: follow counts ────────────────────────────────


@pytest.mark.django_db
class TestPublicProfileFollowCounts:
    def test_profile_includes_count_fields(self, client, registered_user):
        response = client.get(f'/users/{registered_user.pk}/')
        assert 'followers_count' in response.data
        assert 'following_count' in response.data

    def test_counts_are_zero_initially(self, client, registered_user):
        response = client.get(f'/users/{registered_user.pk}/')
        assert response.data['followers_count'] == 0
        assert response.data['following_count'] == 0

    def test_followers_count_reflects_state(self, client, registered_user, second_user):
        Follow.objects.create(follower=second_user, followed=registered_user)
        response = client.get(f'/users/{registered_user.pk}/')
        assert response.data['followers_count'] == 1
        assert response.data['following_count'] == 0

    def test_following_count_reflects_state(self, client, registered_user, second_user):
        Follow.objects.create(follower=registered_user, followed=second_user)
        response = client.get(f'/users/{registered_user.pk}/')
        assert response.data['following_count'] == 1
        assert response.data['followers_count'] == 0

    def test_followers_count_excludes_inactive_follower(self, client, registered_user, second_user):
        Follow.objects.create(follower=second_user, followed=registered_user)
        second_user.is_active = False
        second_user.save()
        response = client.get(f'/users/{registered_user.pk}/')
        assert response.data['followers_count'] == 0

    def test_following_count_excludes_inactive_followed(self, client, registered_user, second_user):
        Follow.objects.create(follower=registered_user, followed=second_user)
        second_user.is_active = False
        second_user.save()
        response = client.get(f'/users/{registered_user.pk}/')
        assert response.data['following_count'] == 0


# ── GET /users/<user_id>/bookmarks/ ──────────────────────────────────────────

@pytest.mark.django_db
class TestUserBookmarksView:
    url = '/users/{user_id}/bookmarks/'

    def _make_story(self, user, title='Story'):
        return Story.objects.create(
            user=user,
            title=title,
            narrative='Narrative text.',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('41.0'),
            location_lng=Decimal('29.0'),
            location_name='Istanbul',
            time_type=Story.TIME_EXACT,
            year=2000,
        )

    def test_owner_retrieves_bookmarks_returns_200(self, auth_client, registered_user):
        story = self._make_story(registered_user)
        SavedStory.objects.create(user=registered_user, story=story)
        response = auth_client.get(self.url.format(user_id=registered_user.pk))
        assert response.status_code == 200
        assert response.data['count'] == 1

    def test_response_is_paginated(self, auth_client, registered_user):
        response = auth_client.get(self.url.format(user_id=registered_user.pk))
        assert response.status_code == 200
        for key in ['count', 'next', 'previous', 'results']:
            assert key in response.data

    def test_empty_bookmarks_returns_empty_results(self, auth_client, registered_user):
        response = auth_client.get(self.url.format(user_id=registered_user.pk))
        assert response.status_code == 200
        assert response.data['count'] == 0
        assert response.data['results'] == []

    def test_results_ordered_most_recently_saved_first(self, auth_client, registered_user, second_user):
        story1 = self._make_story(second_user, title='Older')
        story2 = self._make_story(second_user, title='Newer')
        ss1 = SavedStory.objects.create(user=registered_user, story=story1)
        SavedStory.objects.filter(pk=ss1.pk).update(
            saved_at=timezone.now() - datetime.timedelta(seconds=5)
        )
        SavedStory.objects.create(user=registered_user, story=story2)
        response = auth_client.get(self.url.format(user_id=registered_user.pk))
        ids = [r['id'] for r in response.data['results']]
        assert ids == [story2.pk, story1.pk]

    def test_removed_stories_excluded(self, auth_client, registered_user):
        story = self._make_story(registered_user)
        SavedStory.objects.create(user=registered_user, story=story)
        story.status = Story.STATUS_REMOVED
        story.save()
        response = auth_client.get(self.url.format(user_id=registered_user.pk))
        assert response.data['count'] == 0

    def test_response_contains_story_feed_fields(self, auth_client, registered_user):
        story = self._make_story(registered_user)
        SavedStory.objects.create(user=registered_user, story=story)
        response = auth_client.get(self.url.format(user_id=registered_user.pk))
        result = response.data['results'][0]
        for field in ['id', 'title', 'location_name', 'preview_text', 'submitted_at']:
            assert field in result
        assert result['user_has_saved'] is True
        assert result['user_has_liked'] is False

    def test_unauthenticated_returns_401(self, client, registered_user):
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.status_code == 401

    def test_other_user_returns_403(self, client, registered_user, second_user):
        client.force_authenticate(user=second_user)
        response = client.get(self.url.format(user_id=registered_user.pk))
        assert response.status_code == 403

    def test_user_not_found_returns_404(self, auth_client):
        response = auth_client.get(self.url.format(user_id=99999))
        assert response.status_code == 404

    def test_inactive_user_returns_404(self, auth_client, second_user):
        # Deactivate the TARGET user (not the requester) — Http404 is raised
        # before PermissionDenied in get_user_bookmarks, so this returns 404.
        second_user.is_active = False
        second_user.save()
        response = auth_client.get(self.url.format(user_id=second_user.pk))
        assert response.status_code == 404
