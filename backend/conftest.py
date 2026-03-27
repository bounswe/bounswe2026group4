"""
Shared pytest fixtures available to all apps.

These fixtures provide the minimal valid objects needed across test modules.
Each fixture is kept as simple as possible — tests that need unusual states
create their own objects directly.
"""
from decimal import Decimal

import pytest

from apps.stories.models import Story
from apps.users.models import RoleChoices, User


@pytest.fixture
def user(db):
    """Minimal valid registered user."""
    return User.objects.create_user(
        email='user@example.com',
        username='testuser',
        password='Password1',
    )


@pytest.fixture
def second_user(db):
    """A second distinct user for tests that need two different users."""
    return User.objects.create_user(
        email='other@example.com',
        username='otheruser',
        password='Password1',
    )


@pytest.fixture
def admin_user(db):
    """Admin user for tests that need elevated permissions."""
    return User.objects.create_user(
        email='admin@example.com',
        username='adminuser',
        password='Password1',
        role=RoleChoices.ADMIN,
        is_staff=True,
    )


@pytest.fixture
def story(user):
    """Minimal valid published story owned by `user`."""
    return Story.objects.create(
        user=user,
        title='A Test Story',
        narrative='Some narrative text.',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('41.015137'),
        location_lng=Decimal('28.979530'),
        location_name='Istanbul',
        time_type=Story.TIME_EXACT,
        year=1453,
    )