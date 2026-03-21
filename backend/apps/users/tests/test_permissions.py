from unittest.mock import MagicMock

from apps.users.permissions import CanManageOwnProfile


def make_request(role, is_authenticated=True):
    user = MagicMock()
    user.is_authenticated = is_authenticated
    user.role = role
    request = MagicMock()
    request.user = user
    return request


def make_anon_request():
    request = MagicMock()
    request.user = MagicMock()
    request.user.is_authenticated = False
    return request


class TestCanManageOwnProfile:
    def setup_method(self):
        self.permission = CanManageOwnProfile()
        self.view = MagicMock()

    def test_owner_can_manage_own_profile(self):
        request = make_request(role='registered_user')
        obj = request.user
        assert self.permission.has_permission(request, self.view) is True
        assert self.permission.has_object_permission(request, self.view, obj) is True

    def test_admin_can_manage_any_profile(self):
        request = make_request(role='admin')
        other_user = MagicMock()
        assert self.permission.has_permission(request, self.view) is True
        assert self.permission.has_object_permission(request, self.view, other_user) is True

    def test_registered_user_cannot_manage_other_profile(self):
        request = make_request(role='registered_user')
        other_user = MagicMock()
        assert self.permission.has_object_permission(request, self.view, other_user) is False

    def test_unauthenticated_user_is_denied_at_request_level(self):
        # has_permission must fail before object-level checks are even reached
        request = make_anon_request()
        assert self.permission.has_permission(request, self.view) is False
