import { TimelineEntity, TimelinePageEntity } from '../../domain/entities';

interface TimelineApiRecord {
  id?: unknown;
  title?: unknown;
  time_type?: unknown;
  timeType?: unknown;
  year?: unknown;
  year_start?: unknown;
  yearStart?: unknown;
  year_end?: unknown;
  yearEnd?: unknown;
  date_value?: unknown;
  dateValue?: unknown;
  time_value?: unknown;
  timeValue?: unknown;
  temporal_coverage?: unknown;
  temporalCoverage?: unknown;
  temporal_coverage_iso8601?: unknown;
  temporalCoverageIso8601?: unknown;
  location_name?: unknown;
  locationName?: unknown;
  placeName?: unknown;
  location_lat?: unknown;
  locationLat?: unknown;
  latitude?: unknown;
  location_lng?: unknown;
  locationLng?: unknown;
  longitude?: unknown;
  photo_url?: unknown;
  photoUrl?: unknown;
  media_url?: unknown;
  mediaUrl?: unknown;
  images?: unknown;
  media_items?: unknown;
}

interface MediaItemRecord {
  url?: unknown;
  media_type?: unknown;
  mediaType?: unknown;
  order?: unknown;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function asIdentifier(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function getTemporalCoverage(record: TimelineApiRecord) {
  return (
    asString(record.temporal_coverage) ||
    asString(record.temporalCoverage) ||
    asString(record.temporal_coverage_iso8601) ||
    asString(record.temporalCoverageIso8601) ||
    undefined
  );
}

function getPhotoUrl(record: TimelineApiRecord) {
  const explicitPhotoUrl =
    asString(record.photo_url) ||
    asString(record.photoUrl) ||
    asString(record.media_url) ||
    asString(record.mediaUrl);

  if (explicitPhotoUrl) {
    return explicitPhotoUrl;
  }

  if (Array.isArray(record.media_items)) {
    const firstImage = (record.media_items as MediaItemRecord[])
      .filter((item) => (item.media_type ?? item.mediaType) === 'image')
      .sort((left, right) => (asNumber(left.order) ?? 0) - (asNumber(right.order) ?? 0))[0];

    if (typeof firstImage?.url === 'string') {
      return firstImage.url;
    }
  }

  if (!Array.isArray(record.images)) {
    return undefined;
  }

  const firstImage = record.images[0];

  if (typeof firstImage === 'string') {
    return firstImage;
  }

  if (firstImage && typeof firstImage === 'object') {
    return asString((firstImage as Record<string, unknown>).url) || undefined;
  }

  return undefined;
}

function getDateYear(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value.slice(0, 4));

  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatTimePeriod(record: TimelineApiRecord) {
  const timeType = asString(record.time_type) || asString(record.timeType);
  const year = asNumber(record.year);
  const yearStart = asNumber(record.year_start) ?? asNumber(record.yearStart);
  const yearEnd = asNumber(record.year_end) ?? asNumber(record.yearEnd);
  const dateValue = asString(record.date_value) || asString(record.dateValue);
  const timeValue = asString(record.time_value) || asString(record.timeValue);

  switch (timeType) {
    case 'exact_year':
      return year !== undefined ? String(year) : '';
    case 'approximate_year':
      return year !== undefined ? `c. ${year}` : '';
    case 'decade':
      return year !== undefined ? `${Math.floor(year / 10) * 10}s` : '';
    case 'year_range':
      return yearStart !== undefined && yearEnd !== undefined ? `${yearStart}-${yearEnd}` : '';
    case 'exact_date':
      return dateValue ? `${dateValue}${timeValue ? ` ${timeValue.slice(0, 5)}` : ''}` : '';
    default:
      return getTemporalCoverage(record) ?? '';
  }
}

export function getTimelineHistoricalYear(value: unknown) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as TimelineApiRecord;
  const timeType = asString(record.time_type) || asString(record.timeType);
  const year = asNumber(record.year);
  const yearStart = asNumber(record.year_start) ?? asNumber(record.yearStart);
  const yearEnd = asNumber(record.year_end) ?? asNumber(record.yearEnd);
  const dateYear = getDateYear(asString(record.date_value) || asString(record.dateValue));

  switch (timeType) {
    case 'year_range':
      return yearStart !== undefined && yearEnd !== undefined ? Math.floor((yearStart + yearEnd) / 2) : undefined;
    case 'decade':
      return year !== undefined ? year + 5 : undefined;
    case 'exact_date':
      return dateYear;
    default:
      return year;
  }
}

export function mapTimelineItem(value: unknown): TimelineEntity {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid timeline item payload.');
  }

  const record = value as TimelineApiRecord;
  const id = asIdentifier(record.id);
  const title = asString(record.title);

  if (!id || !title) {
    throw new Error('Invalid timeline item payload.');
  }

  const latitude = asNumber(record.location_lat) ?? asNumber(record.locationLat) ?? asNumber(record.latitude);
  const longitude = asNumber(record.location_lng) ?? asNumber(record.locationLng) ?? asNumber(record.longitude);

  return {
    id,
    title,
    timeType: asString(record.time_type) || asString(record.timeType),
    timePeriod: formatTimePeriod(record),
    temporalCoverage: getTemporalCoverage(record),
    historicalYear: getTimelineHistoricalYear(record),
    year: asNumber(record.year),
    yearStart: asNumber(record.year_start) ?? asNumber(record.yearStart),
    yearEnd: asNumber(record.year_end) ?? asNumber(record.yearEnd),
    dateValue: asString(record.date_value) || asString(record.dateValue) || undefined,
    timeValue: asString(record.time_value) || asString(record.timeValue) || undefined,
    locationName:
      asString(record.location_name) ||
      asString(record.locationName) ||
      asString(record.placeName) ||
      undefined,
    latitude,
    longitude,
    photoUrl: getPhotoUrl(record),
  };
}

export function mapTimelinePage(
  value: unknown,
  requestedPage: number,
  pageSize: number,
): TimelinePageEntity {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid timeline page payload.');
  }

  const record = value as Record<string, unknown>;
  const results = Array.isArray(record.results) ? record.results.map(mapTimelineItem) : [];
  const totalCount = asNumber(record.count) ?? 0;

  return {
    items: results,
    page: requestedPage,
    pageSize,
    totalCount,
    hasNextPage: Boolean(record.next),
  };
}

export const mapTimeline = mapTimelineItem;
