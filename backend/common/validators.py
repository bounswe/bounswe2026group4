import re

from rest_framework import serializers


def validate_password_strength(password: str) -> str:
    """
    Enforces password rules from req. 1.2.1.4:
    - At least 8 characters
    - At least 1 digit
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    """
    errors = []

    if len(password) < 8:
        errors.append('Password must be at least 8 characters long.')
    if not re.search(r'[0-9]', password):
        errors.append('Password must contain at least one number.')
    if not re.search(r'[A-Z]', password):
        errors.append('Password must contain at least one uppercase letter.')
    if not re.search(r'[a-z]', password):
        errors.append('Password must contain at least one lowercase letter.')

    if errors:
        raise serializers.ValidationError(errors)

    return password
