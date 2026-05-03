import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.tags.models import Tag
from apps.users.models import RoleChoices, User

TAG_LIST_URL = '/tags/'


def tag_detail_url(pk):
    return f'/tags/{pk}/'


def make_user(email='viewuser@example.com', username='viewuser', role=RoleChoices.REGISTERED_USER):
    return User.objects.create_user(email=email, username=username, password='Pass1234', role=role, is_active=True)


def make_admin(email='viewadmin@example.com', username='viewadmin'):
    return User.objects.create_user(
        email=email, username=username, password='Pass1234',
        role=RoleChoices.ADMIN, is_staff=True, is_active=True,
    )


@pytest.mark.django_db
class TestTagListView:
    def test_unauthenticated_can_list_tags(self):
        client = APIClient()
        response = client.get(TAG_LIST_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_returns_all_tags_by_default(self):
        Tag.objects.create(name='view-tag-a')
        Tag.objects.create(name='view-tag-b')
        client = APIClient()
        response = client.get(TAG_LIST_URL)
        names = [t['name'] for t in response.data]
        assert 'view-tag-a' in names
        assert 'view-tag-b' in names

    def test_is_predefined_true_returns_only_predefined(self):
        Tag.objects.create(name='view-pre-tag', is_predefined=True)
        Tag.objects.create(name='view-user-tag', is_predefined=False)
        client = APIClient()
        response = client.get(TAG_LIST_URL, {'is_predefined': 'true'})
        assert response.status_code == status.HTTP_200_OK
        names = [t['name'] for t in response.data]
        assert 'view-pre-tag' in names
        assert 'view-user-tag' not in names

    def test_is_predefined_false_returns_only_user_created(self):
        Tag.objects.create(name='view-pre-tag2', is_predefined=True)
        Tag.objects.create(name='view-user-tag2', is_predefined=False)
        client = APIClient()
        response = client.get(TAG_LIST_URL, {'is_predefined': 'false'})
        assert response.status_code == status.HTTP_200_OK
        names = [t['name'] for t in response.data]
        assert 'view-user-tag2' in names
        assert 'view-pre-tag2' not in names

    def test_q_filters_by_name(self):
        Tag.objects.create(name='view-unique-qfilter')
        Tag.objects.create(name='view-other-tag')
        client = APIClient()
        response = client.get(TAG_LIST_URL, {'q': 'unique-qfilter'})
        assert response.status_code == status.HTTP_200_OK
        names = [t['name'] for t in response.data]
        assert names == ['view-unique-qfilter']

    def test_combined_is_predefined_and_q_filter(self):
        Tag.objects.create(name='view-combo-user', is_predefined=False)
        Tag.objects.create(name='view-combo-admin', is_predefined=True)
        client = APIClient()
        response = client.get(TAG_LIST_URL, {'is_predefined': 'false', 'q': 'view-combo'})
        assert response.status_code == status.HTTP_200_OK
        names = [t['name'] for t in response.data]
        assert names == ['view-combo-user']

    def test_response_contains_expected_fields(self):
        Tag.objects.create(name='view-field-check')
        client = APIClient()
        response = client.get(TAG_LIST_URL, {'q': 'view-field-check'})
        tag = response.data[0]
        assert set(tag.keys()) == {'id', 'name', 'is_predefined', 'story_count'}


@pytest.mark.django_db
class TestTagCreateView:
    def test_registered_user_creates_new_tag(self):
        user = make_user()
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post(TAG_LIST_URL, {'name': 'view-new-tag'}, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'view-new-tag'
        assert response.data['is_predefined'] is False

    def test_duplicate_returns_200_with_existing_tag(self):
        Tag.objects.create(name='view-dup-tag')
        user = make_user(email='dupuser@example.com', username='dupuser')
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post(TAG_LIST_URL, {'name': 'view-dup-tag'}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'view-dup-tag'

    def test_mixed_case_input_normalized_and_matched(self):
        Tag.objects.create(name='view-norm-tag')
        user = make_user(email='normuser@example.com', username='normuser')
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post(TAG_LIST_URL, {'name': 'View Norm Tag'}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'view-norm-tag'

    def test_admin_creates_tag_with_is_predefined_true(self):
        admin = make_admin()
        client = APIClient()
        client.force_authenticate(user=admin)
        response = client.post(TAG_LIST_URL, {'name': 'view-admin-tag'}, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['is_predefined'] is True

    def test_unauthenticated_cannot_create_tag(self):
        client = APIClient()
        response = client.post(TAG_LIST_URL, {'name': 'view-unauth-tag'}, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_invalid_name_after_normalization_returns_400(self):
        user = make_user(email='baduser@example.com', username='baduser')
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post(TAG_LIST_URL, {'name': '!@#$%'}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_is_predefined_field_in_request_is_ignored(self):
        user = make_user(email='ignoreuser@example.com', username='ignoreuser')
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post(
            TAG_LIST_URL, {'name': 'view-ignore-flag', 'is_predefined': True}, format='json',
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['is_predefined'] is False


@pytest.mark.django_db
class TestTagDeleteView:
    def test_admin_deletes_tag(self):
        tag = Tag.objects.create(name='view-delete-me')
        admin = make_admin()
        client = APIClient()
        client.force_authenticate(user=admin)
        response = client.delete(tag_detail_url(tag.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Tag.objects.filter(pk=tag.pk).exists()

    def test_registered_user_cannot_delete_tag(self):
        tag = Tag.objects.create(name='view-no-delete')
        user = make_user(email='nodelete@example.com', username='nodelete')
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.delete(tag_detail_url(tag.pk))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_cannot_delete_tag(self):
        tag = Tag.objects.create(name='view-unauth-delete')
        client = APIClient()
        response = client.delete(tag_detail_url(tag.pk))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_delete_unknown_pk_returns_404(self):
        admin = make_admin(email='admin404@example.com', username='admin404')
        client = APIClient()
        client.force_authenticate(user=admin)
        response = client.delete(tag_detail_url(99999))
        assert response.status_code == status.HTTP_404_NOT_FOUND
