import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User


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
        import datetime
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
        import datetime
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
