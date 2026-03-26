from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.stories.models import Story
from apps.users.models import RoleChoices, User


def make_story_payload(**overrides):
    payload = {
        'title': 'The City Walls',
        'narrative': 'A story about the walls of the city.',
        'location_lat': '41.008200',
        'location_lng': '28.978400',
        'location_name': 'Old City',
        'region': 'Fatih',
        'time_type': Story.TIME_EXACT,
        'year': 1453,
        'contributor_visible': True,
        'status': Story.STATUS_PUBLISHED,
    }
    payload.update(overrides)
    return payload


class StoryAPITestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='user@example.com',
            username='testuser',
            password='Password1',
        )
        self.second_user = User.objects.create_user(
            email='other@example.com',
            username='otheruser',
            password='Password1',
        )
        self.admin_user = User.objects.create_user(
            email='admin@example.com',
            username='adminuser',
            password='Password1',
            role=RoleChoices.ADMIN,
            is_staff=True,
        )
        self.story = Story.objects.create(
            user=self.user,
            title='A Test Story',
            narrative='Some narrative text.',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('41.015137'),
            location_lng=Decimal('28.979530'),
            location_name='Istanbul',
            time_type=Story.TIME_EXACT,
            year=1453,
        )
        self.list_url = reverse('stories:story-list-create')
        self.detail_url = reverse('stories:story-detail', kwargs={'pk': self.story.pk})

    def test_guest_can_list_stories(self):
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], self.story.id)

    def test_authenticated_user_can_create_story(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(self.list_url, make_story_payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_story = Story.objects.get(pk=response.data['id'])
        self.assertEqual(created_story.user, self.user)
        self.assertEqual(created_story.title, 'The City Walls')

    def test_guest_cannot_create_story(self):
        response = self.client.post(self.list_url, make_story_payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_guest_can_retrieve_story(self):
        response = self.client.get(self.detail_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.story.id)
        self.assertEqual(response.data['title'], self.story.title)

    def test_owner_can_partially_update_story(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.detail_url,
            {'title': 'Updated Story Title', 'region': 'Beyoglu'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.story.refresh_from_db()
        self.assertEqual(self.story.title, 'Updated Story Title')
        self.assertEqual(self.story.region, 'Beyoglu')

    def test_non_owner_cannot_update_story(self):
        self.client.force_authenticate(user=self.second_user)

        response = self.client.patch(
            self.detail_url,
            {'title': 'Not Allowed'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.story.refresh_from_db()
        self.assertNotEqual(self.story.title, 'Not Allowed')

    def test_admin_can_update_any_story(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.detail_url,
            {'title': 'Admin Updated Title'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.story.refresh_from_db()
        self.assertEqual(self.story.title, 'Admin Updated Title')

    def test_guest_cannot_update_story(self):
        response = self.client.patch(
            self.detail_url,
            {'title': 'Guest Update'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_sets_authenticated_user_even_if_user_not_sent(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.list_url,
            make_story_payload(title='Ownership Test'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_story = Story.objects.get(pk=response.data['id'])
        self.assertEqual(created_story.user, self.user)
        self.assertEqual(created_story.location_lat, Decimal('41.008200'))
