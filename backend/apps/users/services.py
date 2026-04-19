import logging

import magic

from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.http import Http404

from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import AuthenticationFailed, ValidationError

from apps.users.models import EmailVerificationCode, Follow, User, UserProfile

_MAX_PHOTO_SIZE = 2 * 1024 * 1024  # 2 MB
_ALLOWED_PHOTO_MIME_TYPES = {'image/jpeg', 'image/png'}

logger = logging.getLogger(__name__)


def register_user(validated_data: dict) -> User:
    """
    Creates a new user and generates an email verification code.
    The code is currently not sent — email infra is not yet implemented.
    """
    user = User.objects.create_user(
        email=validated_data['email'],
        username=validated_data['username'],
        password=validated_data['password'],
    )

    # Generate and store a verification code for future use 
    code = EmailVerificationCode.generate_code()
    EmailVerificationCode.objects.create(user=user, code=code)

    # TODO: replace with actual email sending once email infra is ready
    logger.info('[STUB] Email verification code %s', code)

    return user


def login_user(email: str, password: str) -> dict:
    """
    Authenticates a user and returns JWT tokens.
    Raises AuthenticationFailed for any invalid credentials — intentionally
    using the same error message for wrong email, wrong password, and inactive
    accounts to prevent user enumeration attacks.
    """
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        raise AuthenticationFailed('Invalid credentials.')

    if not user.check_password(password):
        raise AuthenticationFailed('Invalid credentials.')

    if not user.is_active:
        # Use the same message as invalid credentials to avoid revealing that the account exists
        raise AuthenticationFailed('Invalid credentials.')

    # Issue JWT tokens and attach custom claims for frontend convenience
    refresh = RefreshToken.for_user(user)
    refresh['role'] = user.role
    refresh['username'] = user.username

    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'role': user.role,
        },
    }


def logout_user(refresh_token: str) -> None:
    """
    Blacklists the given refresh token, effectively invalidating it.
    The access token expires naturally after its short lifetime (15 min in prod).
    """
    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
    except TokenError:
        # Token is already blacklisted or malformed — treat as already logged out
        raise ValidationError({'refresh': 'Token is invalid or already blacklisted.'})


def get_own_profile(user: User) -> User:
    """
    Returns the authenticated user with their profile pre-fetched, creating the
    UserProfile row if it does not yet exist.

    get_or_create guarantees the profile is present so the view and serializer
    never have to handle a missing profile for the owner.
    """
    UserProfile.objects.get_or_create(user=user)
    return User.objects.select_related('profile').get(pk=user.pk)


def update_own_profile(user: User, user_fields: dict, profile_fields: dict) -> User:
    """
    Applies partial updates to the user's own User and UserProfile records.

    user_fields maps to User model attributes (username, is_username_public).
    profile_fields maps to UserProfile attributes (bio, location, birth_date, etc.).
    The UserProfile row is created via get_or_create when profile_fields is non-empty,
    so callers do not need to ensure the profile exists beforehand.
    Returns the updated user with the profile pre-fetched.
    """
    if user_fields:
        for attr, value in user_fields.items():
            setattr(user, attr, value)
        user.save(update_fields=list(user_fields.keys()))

    if profile_fields:
        profile, _ = UserProfile.objects.get_or_create(user=user)
        for attr, value in profile_fields.items():
            setattr(profile, attr, value)
        profile.save(update_fields=list(profile_fields.keys()))

    return User.objects.select_related('profile').get(pk=user.pk)


def upload_profile_photo(user: User, file) -> UserProfile:
    """
    Validates and saves a profile photo for the given user.
    Enforces a 2 MB size limit and restricts MIME type to JPEG/PNG via
    python-magic (reads file bytes, not just the extension).
    Deletes the previous photo file before saving the new one to avoid orphaned files.
    """
    if file.size > _MAX_PHOTO_SIZE:
        raise ValidationError({'photo': 'File size must not exceed 2 MB.'})

    # Read the first 2048 bytes for MIME sniffing, then reset so the full file is saved
    mime = magic.from_buffer(file.read(2048), mime=True)
    file.seek(0)

    if mime not in _ALLOWED_PHOTO_MIME_TYPES:
        raise ValidationError({'photo': 'Only JPEG and PNG images are allowed.'})

    profile, _ = UserProfile.objects.get_or_create(user=user)

    if profile.profile_photo:
        # Delete the stored file so it doesn't become an orphan on disk
        profile.profile_photo.delete(save=False)

    profile.profile_photo = file
    profile.save(update_fields=['profile_photo'])
    return profile


def delete_profile_photo(user: User) -> None:
    """
    Removes the profile photo file from storage and clears the field.
    No-op when the user has no profile row or no photo set.
    """
    try:
        profile = UserProfile.objects.get(user=user)
    except UserProfile.DoesNotExist:
        return

    if profile.profile_photo:
        profile.profile_photo.delete(save=False)
        profile.profile_photo = None
        profile.save(update_fields=['profile_photo'])


def delete_account(user: User, hard_delete: bool, refresh_token: str = '') -> None:
    """
    Deletes or deactivates a user account based on the hard_delete flag.

    Hard delete: removes profile photo file, explicitly deletes all user stories
    (required because Story.user has on_delete=SET_NULL — without this the stories
    would be anonymized instead of removed), then deletes the User row (cascades
    UserProfile and EmailVerificationCode).

    Soft delete: sets is_active=False to block login, then bulk-sets story.user=NULL
    to anonymize community content without removing it.

    In both cases, if a non-empty refresh_token is provided it is blacklisted.
    TokenError is silently ignored — a stale or already-blacklisted token is harmless
    once the account is gone or inactive.
    """
    from apps.stories.models import Story  # local import to avoid circular imports

    if refresh_token:
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            pass

    if hard_delete:
        delete_profile_photo(user)
        Story.objects.filter(user=user).delete()
        user.delete()
    else:
        user.is_active = False
        user.save(update_fields=['is_active'])
        Story.objects.filter(user=user).update(user=None)


def get_public_profile(user_id: int) -> User:
    """
    Return a User annotated with published_story_count for the public profile endpoint.

    select_related('profile') pre-fetches the optional UserProfile in the same query
    to avoid an extra DB round-trip in the serializer.

    Raises Http404 when the user does not exist or is inactive (banned).
    """
    from apps.stories.models import Story  # local import to avoid circular imports

    try:
        return (
            User.objects
            .select_related('profile')
            .annotate(
                published_story_count=Count(
                    'stories',
                    filter=Q(stories__status=Story.STATUS_PUBLISHED),
                    distinct=True,
                ),
                followers_count=Count('followers', distinct=True),
                following_count=Count('following', distinct=True),
            )
            .get(pk=user_id, is_active=True)
        )
    except User.DoesNotExist:
        raise Http404


def follow_user(follower: User, followed_id: int):
    """
    Create a follow relationship from follower to the user identified by followed_id.

    Returns (Follow, created) — created=True on first follow, False on re-follow.
    Raises Http404 if the target user does not exist or is inactive.
    Raises ValidationError on self-follow attempt.

    get_or_create is wrapped in transaction.atomic() because MySQL marks the
    transaction broken on UniqueConstraint violation — the savepoint lets us
    recover and return the existing row instead.
    """
    try:
        followed_user = User.objects.get(pk=followed_id, is_active=True)
    except User.DoesNotExist:
        raise Http404

    if follower.pk == followed_id:
        raise ValidationError({'detail': 'Cannot follow yourself.'})

    try:
        with transaction.atomic():
            follow, created = Follow.objects.get_or_create(
                follower=follower,
                followed=followed_user,
            )
    except IntegrityError:
        follow = Follow.objects.get(follower=follower, followed=followed_user)
        created = False

    return follow, created


def unfollow_user(follower: User, followed_id: int) -> None:
    """
    Remove the follow relationship from follower to followed_id.

    Idempotent — no exception if the user is not currently following.
    Raises Http404 if the target user does not exist at all.

    Intentionally does not check is_active: a deactivated account must still
    be unfollowable so callers can clean up stale follow relationships.
    Blocking unfollow on inactive targets would leave orphaned edges with no
    way to remove them.
    """
    if not User.objects.filter(pk=followed_id).exists():
        raise Http404
    Follow.objects.filter(follower=follower, followed_id=followed_id).delete()
