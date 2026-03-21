from common.permissions import IsOwnerOrAdmin, IsRegisteredUser


class CanManageOwnProfile(IsRegisteredUser):
    """
    Allows a registered user to manage their own profile.
    Admins can manage any profile.

    Extends IsRegisteredUser so the request-level authentication check is
    inherited — object-level ownership is checked on top of it.
    """

    message = 'You can only manage your own profile.'

    def has_object_permission(self, request, view, obj):
        # Reuse IsOwnerOrAdmin object-level logic rather than duplicating it
        return IsOwnerOrAdmin().has_object_permission(request, view, obj)
