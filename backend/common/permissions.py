from rest_framework.permissions import BasePermission

from apps.users.models import RoleChoices


class IsRegisteredUser(BasePermission):
    """
    Grants access to any authenticated user regardless of role.
    Admins pass this check too — they can do everything registered users can (req. 1.1.3).
    """

    message = 'Authentication required.'

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in (RoleChoices.REGISTERED_USER, RoleChoices.ADMIN)
        )


class IsAdminUser(BasePermission):
    """Grants access exclusively to users with the admin role."""

    message = 'Admin access required.'

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == RoleChoices.ADMIN
        )


class IsGuest(BasePermission):
    """
    Grants access only to unauthenticated requests.
    Useful for endpoints that should redirect authenticated users away
    (e.g. a future GET /auth/status endpoint).
    """

    message = 'You are already authenticated.'

    def has_permission(self, request, view):
        return not request.user or not request.user.is_authenticated


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level permission: allows access if the requester owns the object or is an admin.

    Supports two object shapes:
    - The object itself is the user (e.g. a User profile)
    - The object has a `.user` FK attribute (e.g. a Story, Comment)

    Also enforces authentication at the request level so that unauthenticated
    requests never reach has_object_permission (where AnonymousUser has no role).
    """

    message = 'You do not have permission to access this resource.'

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.role == RoleChoices.ADMIN:
            return True
        return obj == request.user or getattr(obj, 'user', None) == request.user
