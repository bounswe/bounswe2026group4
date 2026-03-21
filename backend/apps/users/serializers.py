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
