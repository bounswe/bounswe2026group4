from common.permissions import IsOwnerOrAdmin, IsRegisteredUser
import hashlib


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

class Sha512InputTooLong(Exception): # A placeholder for a custom exception to handle input that exceeds the allowed length
                                     # Back-end developers can implement this exception to provide more specific error handling in the future
                                     # Passing to front-end is possible
    pass

def sha512_hash(password: str) -> int: # Assumes password is in UTF-8 encoding
    # Convert the integer to bytes (8 bytes for standard 64-bit int)
    bytes = password.encode('utf-8')
    # Check if it exceeds 512 bits (64 bytes)
    if len(bytes) > 64:
        raise Sha512InputTooLong(f"Input string exceeds 512 bits (64 bytes). It is {len(bytes)*8} bits.")
    # Compute SHA-512 hash
    h_bytes = hashlib.sha512(bytes).digest()
    # Convert hash bytes to a large integer
    h_int = int.from_bytes(h_bytes, byteorder='big')
    return h_int
