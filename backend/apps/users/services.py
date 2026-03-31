import logging

from django.db.models import Count, Q
from django.http import Http404

from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import AuthenticationFailed, ValidationError

from apps.users.models import EmailVerificationCode, User, UserProfile

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
                )
            )
            .get(pk=user_id, is_active=True)
        )
    except User.DoesNotExist:
        raise Http404
