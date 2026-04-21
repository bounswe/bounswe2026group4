import pytest

from apps.tags.serializers import TagSerializer


@pytest.mark.django_db
class TestTagSerializer:
    def test_valid_slug_format_is_accepted(self):
        s = TagSerializer(data={'name': 'ottoman-era'})
        assert s.is_valid(), s.errors

    def test_valid_single_word_is_accepted(self):
        s = TagSerializer(data={'name': 'history'})
        assert s.is_valid(), s.errors

    def test_valid_name_with_digits_is_accepted(self):
        s = TagSerializer(data={'name': '19th-century'})
        assert s.is_valid(), s.errors

    # ── Normalization ────────────────────────────────────────────────────────

    def test_uppercase_is_normalized_to_lowercase(self):
        s = TagSerializer(data={'name': 'Ottoman'})
        assert s.is_valid(), s.errors
        assert s.validated_data['name'] == 'ottoman'

    def test_spaces_are_converted_to_hyphens(self):
        s = TagSerializer(data={'name': 'ottoman era'})
        assert s.is_valid(), s.errors
        assert s.validated_data['name'] == 'ottoman-era'

    def test_underscores_are_converted_to_hyphens(self):
        s = TagSerializer(data={'name': 'ottoman_era'})
        assert s.is_valid(), s.errors
        assert s.validated_data['name'] == 'ottoman-era'

    def test_mixed_case_spaces_normalized(self):
        s = TagSerializer(data={'name': 'Ottoman Era'})
        assert s.is_valid(), s.errors
        assert s.validated_data['name'] == 'ottoman-era'

    def test_special_characters_are_stripped(self):
        s = TagSerializer(data={'name': 'ottoman@era!'})
        assert s.is_valid(), s.errors
        assert s.validated_data['name'] == 'ottomanera'

    def test_leading_and_trailing_hyphens_are_stripped(self):
        s = TagSerializer(data={'name': '-ottoman-'})
        assert s.is_valid(), s.errors
        assert s.validated_data['name'] == 'ottoman'

    def test_consecutive_hyphens_are_collapsed(self):
        s = TagSerializer(data={'name': 'otto--man'})
        assert s.is_valid(), s.errors
        assert s.validated_data['name'] == 'otto-man'

    # ── Rejection ───────────────────────────────────────────────────────────

    def test_empty_string_is_rejected(self):
        s = TagSerializer(data={'name': ''})
        assert not s.is_valid()
        assert 'name' in s.errors

    def test_whitespace_only_is_rejected(self):
        s = TagSerializer(data={'name': '   '})
        assert not s.is_valid()
        assert 'name' in s.errors

    def test_all_special_chars_is_rejected(self):
        s = TagSerializer(data={'name': '!@#$%'})
        assert not s.is_valid()
        assert 'name' in s.errors

    def test_missing_name_field_is_rejected(self):
        s = TagSerializer(data={})
        assert not s.is_valid()
        assert 'name' in s.errors

    # ── Read-only fields ─────────────────────────────────────────────────────

    def test_id_is_read_only(self):
        s = TagSerializer(data={'name': 'history', 'id': 999})
        assert s.is_valid()
        assert 'id' not in s.validated_data

    def test_is_predefined_is_read_only(self):
        s = TagSerializer(data={'name': 'history', 'is_predefined': True})
        assert s.is_valid()
        assert 'is_predefined' not in s.validated_data

    def test_story_count_is_read_only(self):
        s = TagSerializer(data={'name': 'history', 'story_count': 100})
        assert s.is_valid()
        assert 'story_count' not in s.validated_data
