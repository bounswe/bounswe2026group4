import {
  buildDateValueFromParts,
  buildEdtfTemporalCoverage,
  isValidDateValue,
  isValidTimeValue,
  normalizeTimeValue,
} from '../temporal';

describe('submission temporal EDTF helpers', () => {
  it('formats supported year-based time types as EDTF strings', () => {
    expect(buildEdtfTemporalCoverage({ timeType: 'exact_year', year: 1965 })).toBe('1965');
    expect(buildEdtfTemporalCoverage({ timeType: 'approximate_year', year: 1965 })).toBe('~1965');
    expect(buildEdtfTemporalCoverage({ timeType: 'decade', year: 1960 })).toBe('196X');
    expect(buildEdtfTemporalCoverage({ timeType: 'year_range', yearStart: 1950, yearEnd: 1975 })).toBe('1950/1975');
  });

  it('formats specific dates and optional times as EDTF strings', () => {
    expect(buildDateValueFromParts('29', '10', '1923')).toBe('1923-10-29');
    expect(buildEdtfTemporalCoverage({ timeType: 'exact_date', dateValue: '1923-10-29' })).toBe('1923-10-29');
    expect(
      buildEdtfTemporalCoverage({
        timeType: 'exact_date',
        dateValue: '1923-10-29',
        timeValue: '09:30',
      }),
    ).toBe('1923-10-29T09:30');
  });

  it('rejects invalid calendar dates and malformed times', () => {
    expect(buildDateValueFromParts('31', '02', '1923')).toBeUndefined();
    expect(isValidDateValue('1923-02-31')).toBe(false);
    expect(isValidTimeValue('24:00')).toBe(false);
    expect(normalizeTimeValue('')).toBeUndefined();
    expect(normalizeTimeValue('09:30')).toBe('09:30');
  });
});
