import datetime
from typing import Optional


def to_edtf(
    time_type: str,
    year: Optional[int],
    year_start: Optional[int],
    year_end: Optional[int],
    date_value: Optional[datetime.date] = None,
    time_value: Optional[datetime.time] = None,
) -> str:
    """Convert Story time fields to an EDTF string.

    For exact_year / approximate_year / decade pass `year`; year_start/year_end are ignored.
    For year_range pass year_start and year_end; year is ignored.
    For exact_date pass date_value; time_value is optional (adds HH:MM precision).
    Raises ValueError for unrecognised time_type values or None required fields.
    """
    if time_type == 'exact_year':
        if year is None:
            raise ValueError("year must not be None for time_type 'exact_year'")
        return str(year)
    if time_type == 'approximate_year':
        if year is None:
            raise ValueError("year must not be None for time_type 'approximate_year'")
        return f"{year}~"
    if time_type == 'decade':
        if year is None:
            raise ValueError("year must not be None for time_type 'decade'")
        return f"{year // 10}X"
    if time_type == 'year_range':
        if year_start is None or year_end is None:
            raise ValueError("year_start and year_end must not be None for time_type 'year_range'")
        return f"{year_start}/{year_end}"
    if time_type == 'exact_date':
        if date_value is None:
            raise ValueError("date_value must not be None for time_type 'exact_date'")
        base = date_value.strftime('%Y-%m-%d')
        if time_value is not None:
            return f"{base}T{time_value.strftime('%H:%M')}"
        return base
    raise ValueError(f"Unknown time_type: {time_type!r}")


def to_iso8601(
    time_type: str,
    year: Optional[int],
    year_start: Optional[int],
    year_end: Optional[int],
    date_value: Optional[datetime.date] = None,
    time_value: Optional[datetime.time] = None,
) -> str:
    """Convert Story time fields to an ISO 8601-compatible string.

    For exact_year / approximate_year / decade pass `year`; year_start/year_end are ignored.
    For year_range pass year_start and year_end; year is ignored.
    For exact_date pass date_value; time_value is optional (adds HH:MM precision).
    Raises ValueError for unrecognised time_type values or None required fields.
    """
    if time_type == 'exact_year':
        if year is None:
            raise ValueError("year must not be None for time_type 'exact_year'")
        return str(year)
    if time_type == 'approximate_year':
        if year is None:
            raise ValueError("year must not be None for time_type 'approximate_year'")
        return str(year)
    if time_type == 'decade':
        if year is None:
            raise ValueError("year must not be None for time_type 'decade'")
        # Caller must pass the decade base year (e.g. 1980 for "1980s").
        return f"{year}/{year + 9}"
    if time_type == 'year_range':
        if year_start is None or year_end is None:
            raise ValueError("year_start and year_end must not be None for time_type 'year_range'")
        return f"{year_start}/{year_end}"
    if time_type == 'exact_date':
        if date_value is None:
            raise ValueError("date_value must not be None for time_type 'exact_date'")
        base = date_value.strftime('%Y-%m-%d')
        if time_value is not None:
            return f"{base}T{time_value.strftime('%H:%M')}"
        return base
    raise ValueError(f"Unknown time_type: {time_type!r}")
