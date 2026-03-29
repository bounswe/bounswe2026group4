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
