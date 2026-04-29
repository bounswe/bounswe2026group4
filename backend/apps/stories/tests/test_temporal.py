import datetime

import pytest

from apps.stories.temporal import to_edtf, to_iso8601


class TestToEdtf:
    def test_exact_year(self):
        assert to_edtf('exact_year', 1950, None, None) == '1950'

    def test_approximate_year(self):
        assert to_edtf('approximate_year', 1950, None, None) == '1950~'

    def test_decade(self):
        assert to_edtf('decade', 1980, None, None) == '198X'

    def test_decade_formula(self):
        assert to_edtf('decade', 1990, None, None) == '199X'

    def test_year_range(self):
        assert to_edtf('year_range', None, 1940, 1960) == '1940/1960'

    def test_negative_exact_year(self):
        assert to_edtf('exact_year', -44, None, None) == '-44'

    def test_negative_approximate_year(self):
        assert to_edtf('approximate_year', -44, None, None) == '-44~'

    def test_negative_decade(self):
        # year=-40 → -40 // 10 = -4 → '-4X'
        assert to_edtf('decade', -40, None, None) == '-4X'

    def test_unknown_time_type_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown time_type"):
            to_edtf('century', 1900, None, None)

    def test_none_year_raises_value_error_for_exact_year(self):
        with pytest.raises(ValueError, match="year must not be None"):
            to_edtf('exact_year', None, None, None)

    def test_exact_date_without_time(self):
        assert to_edtf('exact_date', None, None, None, date_value=datetime.date(1990, 5, 12)) == '1990-05-12'

    def test_exact_date_with_time(self):
        assert to_edtf(
            'exact_date', None, None, None,
            date_value=datetime.date(1990, 5, 12),
            time_value=datetime.time(14, 30),
        ) == '1990-05-12T14:30'

    def test_exact_date_none_date_value_raises(self):
        with pytest.raises(ValueError, match="date_value must not be None"):
            to_edtf('exact_date', None, None, None)


class TestToIso8601:
    def test_exact_year(self):
        assert to_iso8601('exact_year', 1950, None, None) == '1950'

    def test_approximate_year_strips_approximation(self):
        assert to_iso8601('approximate_year', 1950, None, None) == '1950'

    def test_decade(self):
        assert to_iso8601('decade', 1980, None, None) == '1980/1989'

    def test_decade_formula(self):
        assert to_iso8601('decade', 1990, None, None) == '1990/1999'

    def test_year_range(self):
        assert to_iso8601('year_range', None, 1940, 1960) == '1940/1960'

    def test_negative_exact_year(self):
        assert to_iso8601('exact_year', -44, None, None) == '-44'

    def test_negative_approximate_year(self):
        assert to_iso8601('approximate_year', -44, None, None) == '-44'

    def test_negative_decade(self):
        # year=-40 → '-40/-31'
        assert to_iso8601('decade', -40, None, None) == '-40/-31'

    def test_unknown_time_type_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown time_type"):
            to_iso8601('century', 1900, None, None)

    def test_none_year_raises_value_error_for_exact_year(self):
        with pytest.raises(ValueError, match="year must not be None"):
            to_iso8601('exact_year', None, None, None)

    def test_exact_date_without_time(self):
        assert to_iso8601('exact_date', None, None, None, date_value=datetime.date(1990, 5, 12)) == '1990-05-12'

    def test_exact_date_with_time(self):
        assert to_iso8601(
            'exact_date', None, None, None,
            date_value=datetime.date(1990, 5, 12),
            time_value=datetime.time(14, 30),
        ) == '1990-05-12T14:30'

    def test_exact_date_none_date_value_raises(self):
        with pytest.raises(ValueError, match="date_value must not be None"):
            to_iso8601('exact_date', None, None, None)
