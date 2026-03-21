import logging

from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import AuthenticationFailed, ValidationError

from apps.users.models import EmailVerificationCode, User

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
    using the same error message for wrong email or wrong password to prevent
    user enumeration (req. 1.2.1.10).
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
