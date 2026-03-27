from rest_framework.permissions import BasePermission

from apps.users.models import RoleChoices


class IsCommentAuthorOrAdmin(BasePermission):
    """Object-level permission: allows access if the requester authored the comment or is an admin."""

    message = 'You do not have permission to delete this comment.'

    def has_permission(self, request, view):
        # Reject unauthenticated requests before object lookup
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.role == RoleChoices.ADMIN:
            return True
        return obj.author == request.user
