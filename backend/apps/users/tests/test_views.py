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
        # Same error message for both cases to prevent user enumeration (req. 1.2.1.10)
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
