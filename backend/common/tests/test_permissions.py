from unittest.mock import MagicMock

from common.permissions import IsAdminUser, IsGuest, IsOwnerOrAdmin, IsRegisteredUser


def make_request(role=None, is_authenticated=True):
    """Helper to build a mock request with a user attached."""
    user = MagicMock()
    user.is_authenticated = is_authenticated
    user.role = role
    request = MagicMock()
    request.user = user
    return request


def make_anon_request():
    """Helper to build a mock request with an anonymous (unauthenticated) user."""
    request = MagicMock()
    request.user = MagicMock()
    request.user.is_authenticated = False
    return request


class TestIsRegisteredUser:
    def setup_method(self):
        self.permission = IsRegisteredUser()
        self.view = MagicMock()

    def test_registered_user_is_allowed(self):
        request = make_request(role='registered_user')
        assert self.permission.has_permission(request, self.view) is True

    def test_admin_is_allowed(self):
        # Admins can do everything registered users can (req. 1.1.3)
        request = make_request(role='admin')
        assert self.permission.has_permission(request, self.view) is True

    def test_unauthenticated_is_denied(self):
        request = make_anon_request()
        assert self.permission.has_permission(request, self.view) is False


class TestIsAdminUser:
    def setup_method(self):
        self.permission = IsAdminUser()
        self.view = MagicMock()

    def test_admin_is_allowed(self):
        request = make_request(role='admin')
        assert self.permission.has_permission(request, self.view) is True

    def test_registered_user_is_denied(self):
        request = make_request(role='registered_user')
        assert self.permission.has_permission(request, self.view) is False

    def test_unauthenticated_is_denied(self):
        request = make_anon_request()
        assert self.permission.has_permission(request, self.view) is False


class TestIsGuest:
    def setup_method(self):
        self.permission = IsGuest()
        self.view = MagicMock()

    def test_unauthenticated_is_allowed(self):
        request = make_anon_request()
        assert self.permission.has_permission(request, self.view) is True

    def test_authenticated_registered_user_is_denied(self):
        request = make_request(role='registered_user')
        assert self.permission.has_permission(request, self.view) is False

    def test_authenticated_admin_is_denied(self):
        request = make_request(role='admin')
        assert self.permission.has_permission(request, self.view) is False


class TestIsOwnerOrAdmin:
    def setup_method(self):
        self.permission = IsOwnerOrAdmin()
        self.view = MagicMock()

    def test_unauthenticated_is_denied_at_request_level(self):
        # AnonymousUser has no .role — must be blocked before has_object_permission is reached
        request = make_anon_request()
        assert self.permission.has_permission(request, self.view) is False

    def test_owner_can_access_own_object(self):
        request = make_request(role='registered_user')
        # obj is the user themselves (e.g. profile)
        obj = request.user
        assert self.permission.has_object_permission(request, self.view, obj) is True

    def test_admin_can_access_any_object(self):
        request = make_request(role='admin')
        other_user = MagicMock()
        assert self.permission.has_object_permission(request, self.view, other_user) is True

    def test_non_owner_is_denied(self):
        request = make_request(role='registered_user')
        other_user = MagicMock()  # a different user object
        assert self.permission.has_object_permission(request, self.view, other_user) is False

    def test_owner_via_fk_attribute(self):
        # obj has a .user FK (e.g. a Story or Comment)
        request = make_request(role='registered_user')
        obj = MagicMock()
        obj.user = request.user
        assert self.permission.has_object_permission(request, self.view, obj) is True

    def test_non_owner_via_fk_attribute_is_denied(self):
        request = make_request(role='registered_user')
        obj = MagicMock()
        obj.user = MagicMock()  # belongs to a different user
        assert self.permission.has_object_permission(request, self.view, obj) is False
