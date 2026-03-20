import pytest
from rest_framework import serializers

from common.validators import validate_password_strength


class TestValidatePasswordStrength:
    def test_valid_password_passes(self):
        # Should return the password unchanged when all rules are met
        assert validate_password_strength('StrongPass1') == 'StrongPass1'

    def test_too_short_raises(self):
        with pytest.raises(serializers.ValidationError) as exc:
            validate_password_strength('Short1')
        assert any('8 characters' in str(e) for e in exc.value.detail)

    def test_no_digit_raises(self):
        with pytest.raises(serializers.ValidationError) as exc:
            validate_password_strength('NoDigitPass')
        assert any('number' in str(e) for e in exc.value.detail)

    def test_no_uppercase_raises(self):
        with pytest.raises(serializers.ValidationError) as exc:
            validate_password_strength('nouppercase1')
        assert any('uppercase' in str(e) for e in exc.value.detail)

    def test_no_lowercase_raises(self):
        with pytest.raises(serializers.ValidationError) as exc:
            validate_password_strength('NOLOWERCASE1')
        assert any('lowercase' in str(e) for e in exc.value.detail)

    def test_multiple_violations_returns_all_errors(self):
        # All rules violated — all error messages should be present
        with pytest.raises(serializers.ValidationError) as exc:
            validate_password_strength('short')
        assert len(exc.value.detail) >= 3
