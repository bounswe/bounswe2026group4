export type StoryTimeType = 'exact_year' | 'approximate_year' | 'decade' | 'year_range' | 'exact_date';

export interface StoryTemporalCoverageInput {
  timeType: StoryTimeType;
  year?: number;
  yearStart?: number;
  yearEnd?: number;
  dateValue?: string;
  timeValue?: string;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function padTwoDigits(value: string) {
  return value.trim().padStart(2, '0');
}

function parseTimeValue(value: string) {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());

  if (!match) {
    return undefined;
  }

  const hour = Number(match[1]);

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return undefined;
  }

  return {
    hour: String(hour).padStart(2, '0'),
    minute: match[2],
  };
}

export function isValidDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (year < 1) {
    return false;
  }

  const parsedDate = new Date(Date.UTC(year, month - 1, day, 12));
  parsedDate.setUTCFullYear(year);

  return (
    Number.isFinite(parsedDate.getTime()) &&
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

export function isValidTimeValue(value: string) {
  return parseTimeValue(value) !== undefined;
}

export function buildDateValueFromParts(day: string, month: string, year: string) {
  const trimmedYear = year.trim();
  const dateValue = `${trimmedYear}-${padTwoDigits(month)}-${padTwoDigits(day)}`;

  return isValidDateValue(dateValue) ? dateValue : undefined;
}

export function normalizeTimeValue(value: string) {
  const parsedTime = parseTimeValue(value);

  if (!parsedTime) {
    return undefined;
  }

  return `${parsedTime.hour}:${parsedTime.minute}`;
}

export function buildEdtfTemporalCoverage(input: StoryTemporalCoverageInput) {
  switch (input.timeType) {
    case 'exact_year':
      if (!isFiniteNumber(input.year)) {
        throw new Error('year is required for exact_year.');
      }
      return String(input.year);
    case 'approximate_year':
      if (!isFiniteNumber(input.year)) {
        throw new Error('year is required for approximate_year.');
      }
      return `${input.year}~`;
    case 'decade':
      if (!isFiniteNumber(input.year)) {
        throw new Error('year is required for decade.');
      }
      return `${Math.floor(input.year / 10)}X`;
    case 'year_range':
      if (!isFiniteNumber(input.yearStart) || !isFiniteNumber(input.yearEnd)) {
        throw new Error('yearStart and yearEnd are required for year_range.');
      }
      return `${input.yearStart}/${input.yearEnd}`;
    case 'exact_date':
      if (!input.dateValue || !isValidDateValue(input.dateValue)) {
        throw new Error('dateValue is required for exact_date.');
      }
      if (input.timeValue) {
        const normalizedTimeValue = normalizeTimeValue(input.timeValue);
        if (!normalizedTimeValue) {
          throw new Error('timeValue must use HH:MM format.');
        }
        return `${input.dateValue}T${normalizedTimeValue}`;
      }
      return input.dateValue;
    default:
      throw new Error(`Unsupported time type: ${String(input.timeType)}`);
  }
}
