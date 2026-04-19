from rest_framework import serializers

from apps.users.models import User
from common.validators import validate_password_strength


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    username = serializers.CharField(min_length=3, max_length=150)
    password = serializers.CharField(write_only=True)
    password_confirmation = serializers.CharField(write_only=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value.lower()

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return value

    def validate_password(self, value):
        validate_password_strength(value)
        return value

    def validate(self, data):
        # Cross-field validation: passwords must match
        if data['password'] != data['password_confirmation']:
            raise serializers.ValidationError({'password_confirmation': 'Passwords do not match.'})
        return data


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    # write_only so the password is never included in serializer output
    password = serializers.CharField(write_only=True)


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class UserResponseSerializer(serializers.ModelSerializer):
    """Read-only serializer used to return safe user data in auth responses."""

    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'role', 'is_email_verified', 'date_joined']
        read_only_fields = fields


class UpdateProfileSerializer(serializers.Serializer):
    """Validates editable UserProfile fields accepted by PATCH /users/me/.

    profile_photo is intentionally excluded — use POST /users/me/photo/ instead,
    which enforces MIME type and size limits via the service layer.
    """

    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    location = serializers.CharField(max_length=255, required=False, allow_blank=True)
    birth_date = serializers.DateField(required=False, allow_null=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    is_name_public = serializers.BooleanField(required=False)
    is_location_public = serializers.BooleanField(required=False)
    is_birth_date_public = serializers.BooleanField(required=False)
    is_photo_public = serializers.BooleanField(required=False)


class CurrentUserProfileSerializer(serializers.Serializer):
    """
    Serializes all UserProfile fields for the owner's own view (GET /users/me/).

    Unlike PublicUserProfileSerializer, no visibility filtering is applied — the
    owner always sees all their own data, including privacy flags.
    """

    profile_photo = serializers.SerializerMethodField()
    first_name = serializers.CharField(allow_blank=True)
    last_name = serializers.CharField(allow_blank=True)
    location = serializers.CharField(allow_blank=True)
    birth_date = serializers.DateField()
    bio = serializers.CharField(allow_blank=True)
    is_name_public = serializers.BooleanField()
    is_location_public = serializers.BooleanField()
    is_birth_date_public = serializers.BooleanField()
    is_photo_public = serializers.BooleanField()

    def get_profile_photo(self, obj):
        if not obj.profile_photo:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.profile_photo.url)
        return obj.profile_photo.url


class CurrentUserSerializer(serializers.Serializer):
    """
    Read-only serializer returning the authenticated user's full own profile for GET /users/me/.

    Returns all fields needed by the frontend profile page and edit-profile form,
    including private fields and privacy preference flags that are hidden from the
    public profile endpoint.
    """

    id = serializers.IntegerField()
    email = serializers.EmailField()
    username = serializers.CharField()
    role = serializers.CharField()
    is_username_public = serializers.BooleanField()
    is_email_verified = serializers.BooleanField()
    date_joined = serializers.DateTimeField()
    total_points = serializers.IntegerField()
    profile = serializers.SerializerMethodField()

    def get_profile(self, obj):
        profile = getattr(obj, 'profile', None)
        if profile is None:
            return None
        return CurrentUserProfileSerializer(profile, context=self.context).data


class UpdateCurrentUserSerializer(serializers.Serializer):
    """
    Validates PATCH /users/me/ input.

    Only user-editable fields are declared; system-managed fields (email, role,
    total_points, is_active, is_email_verified, date_joined) are excluded so
    they are silently ignored even if sent in the request body.
    """

    username = serializers.CharField(min_length=3, max_length=150, required=False)
    is_username_public = serializers.BooleanField(required=False)
    profile = UpdateProfileSerializer(required=False)

    def validate_username(self, value):
        # Exclude the current user so they can resubmit their own username without error
        user = self.context['request'].user
        if User.objects.filter(username__iexact=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return value

    def split_validated_data(self):
        """Returns (user_fields, profile_fields) dicts for the service layer."""
        data = self.validated_data
        user_fields = {k: v for k, v in data.items() if k != 'profile'}
        profile_fields = data.get('profile', {})
        return user_fields, profile_fields


class ProfilePhotoSerializer(serializers.Serializer):
    """Validates the multipart photo field for POST /users/me/photo/."""

    photo = serializers.ImageField()


class PublicUserProfileSerializer(serializers.Serializer):
    """
    Read-only serializer for the public user profile endpoint (GET /users/{id}/).

    Visibility rules (Req. 1.2.3.1):
    - username: shown only when is_username_public is True
    - profile_photo, location, birth_year: gated by their per-field flags on UserProfile
    - bio: no visibility flag — always returned when a profile exists
    - total_points, date_joined, published_story_count: always public

    birth_year returns only the year integer (not the full date) per Req. 1.2.3.1.
    """

    id = serializers.IntegerField()
    username = serializers.SerializerMethodField()
    total_points = serializers.IntegerField()
    date_joined = serializers.DateTimeField()
    published_story_count = serializers.IntegerField()
    profile_photo = serializers.SerializerMethodField()
    first_name = serializers.SerializerMethodField()
    last_name = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    bio = serializers.SerializerMethodField()
    birth_year = serializers.SerializerMethodField()

    def _profile(self, obj):
        """Return the UserProfile instance or None if the user has no profile yet."""
        return getattr(obj, 'profile', None)

    def get_username(self, obj):
        return obj.username if obj.is_username_public else None

    def get_profile_photo(self, obj):
        profile = self._profile(obj)
        if profile and profile.is_photo_public and profile.profile_photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(profile.profile_photo.url)
            return profile.profile_photo.url
        return None

    def get_first_name(self, obj):
        profile = self._profile(obj)
        if profile and profile.is_name_public and profile.first_name:
            return profile.first_name
        return None

    def get_last_name(self, obj):
        profile = self._profile(obj)
        if profile and profile.is_name_public and profile.last_name:
            return profile.last_name
        return None

    def get_location(self, obj):
        profile = self._profile(obj)
        if profile and profile.is_location_public and profile.location:
            return profile.location
        return None

    def get_bio(self, obj):
        profile = self._profile(obj)
        return profile.bio if profile else None

    def get_birth_year(self, obj):
        profile = self._profile(obj)
        if profile and profile.is_birth_date_public and profile.birth_date:
            return profile.birth_date.year
        return None


class DeleteAccountSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)
    hard_delete = serializers.BooleanField(default=True, required=False)
    refresh = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_password(self, value):
        """Reject the request immediately if the password is wrong."""
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Incorrect password.')
        return value
