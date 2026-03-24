"""
Shared pytest fixtures available to all apps.

These fixtures provide the minimal valid objects needed across test modules.
Each fixture is kept as simple as possible — tests that need unusual states
create their own objects directly.
"""
from decimal import Decimal

import pytest

from apps.stories.models import PeriodType, Story, StoryStatus
from apps.users.models import User


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
def story(user):
    """Minimal valid published story owned by `user`."""
    return Story.objects.create(
        author=user,
        title='A Test Story',
        narrative_text='Some narrative text.',
        status=StoryStatus.PUBLISHED,
        latitude=Decimal('41.015137'),
        longitude=Decimal('28.979530'),
        place_name='Istanbul',
        period_type=PeriodType.EXACT,
        start_year=1453,
    )
