import { apiClient } from '../../../../core/api/client';
import { endpoints } from '../../../../core/api/endpoints';
import { StoryFilters } from '../../../stories/domain/repositories';
import { TimelineRequest } from '../../domain/repositories';
import { getTimelineHistoricalYear } from '../mappers';

const DEFAULT_PAGE_SIZE = 10;
const FALLBACK_FETCH_PAGE_SIZE = 100;

interface PaginatedTimelineResponse {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: unknown[];
}

export const timelineRemoteSource = {
  async getTimeline(request: TimelineRequest = {}) {
    const page = request.page ?? 1;
    const pageSize = request.pageSize ?? DEFAULT_PAGE_SIZE;
    const filters = normalizeRequestFilters(request);
    const periodYears = resolveTimelinePeriodYears(request) ?? {
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo,
    };

    if (hasUnsupportedTimelineFilters(filters)) {
      return getTimelineViaFallback({
        page,
        pageSize,
        filters,
        yearFrom: periodYears.yearFrom,
        yearTo: periodYears.yearTo,
      });
    }

    return (
      (await apiClient.get<PaginatedTimelineResponse>(
        `${endpoints.stories}/timeline/${buildQueryString({
          page,
          page_size: pageSize,
          ...normalizeTimelineFilters(filters, periodYears.yearFrom, periodYears.yearTo),
        })}`,
      )) ?? emptyTimelineResponse()
    );
  },
};

export const timelineLocalSource = {
  pageSize: DEFAULT_PAGE_SIZE,
};

export function resolveTimelinePeriodYears(request: TimelineRequest) {
  if (request.year !== undefined && Number.isFinite(request.year)) {
    return {
      yearFrom: request.year,
      yearTo: request.year,
    };
  }

  if (
    request.yearRange &&
    Number.isFinite(request.yearRange.from) &&
    Number.isFinite(request.yearRange.to)
  ) {
    return {
      yearFrom: Math.min(request.yearRange.from, request.yearRange.to),
      yearTo: Math.max(request.yearRange.from, request.yearRange.to),
    };
  }

  if (request.decade !== undefined && Number.isFinite(request.decade)) {
    const decade = Math.floor(request.decade / 10) * 10;

    return {
      yearFrom: decade,
      yearTo: decade + 9,
    };
  }

  if (request.approximatePeriod && Number.isFinite(request.approximatePeriod.century)) {
    const century = Math.floor(request.approximatePeriod.century / 100) * 100;

    switch (request.approximatePeriod.position) {
      case 'early':
        return { yearFrom: century, yearTo: century + 33 };
      case 'mid':
        return { yearFrom: century + 34, yearTo: century + 66 };
      case 'late':
        return { yearFrom: century + 67, yearTo: century + 99 };
      default:
        return undefined;
    }
  }

  return undefined;
}

function normalizeRequestFilters(request: TimelineRequest): StoryFilters {
  return {
    ...(request.filters ?? {}),
    ...(request.location !== undefined ? { location: request.location } : {}),
  };
}

function emptyTimelineResponse(): PaginatedTimelineResponse {
  return {
    count: 0,
    next: null,
    previous: null,
    results: [],
  };
}

function hasUnsupportedTimelineFilters(filters: StoryFilters) {
  return Boolean(
    filters.q?.trim() ||
      getSelectedTags(filters).length ||
      (filters.location?.trim() && !filters.locationBounds) ||
      getProximityFilter(filters),
  );
}

async function getTimelineViaFallback({
  page,
  pageSize,
  filters,
  yearFrom,
  yearTo,
}: {
  page: number;
  pageSize: number;
  filters: StoryFilters;
  yearFrom?: number;
  yearTo?: number;
}): Promise<PaginatedTimelineResponse> {
  const query = filters.q?.trim();
  const path = query ? `${endpoints.stories}/search/` : `${endpoints.stories}/feed/`;
  const params = {
    page_size: FALLBACK_FETCH_PAGE_SIZE,
    ...(query ? {} : { sort_by: 'recent' }),
    ...normalizeFallbackFilters(filters, yearFrom, yearTo),
  };
  const results = await fetchAllPages(path, params);
  const filteredResults = results
    .filter((story) => storyMatchesFallbackFilters(story, filters, yearFrom, yearTo))
    .sort((left, right) => {
      const leftYear = getTimelineHistoricalYear(left) ?? Number.MAX_SAFE_INTEGER;
      const rightYear = getTimelineHistoricalYear(right) ?? Number.MAX_SAFE_INTEGER;

      return leftYear - rightYear;
    });
  const startIndex = (page - 1) * pageSize;
  const pageResults = filteredResults.slice(startIndex, startIndex + pageSize);

  return {
    count: filteredResults.length,
    next: startIndex + pageSize < filteredResults.length ? 'client-next-page' : null,
    previous: page > 1 ? 'client-previous-page' : null,
    results: pageResults,
  };
}

async function fetchAllPages(path: string, params: Record<string, string | number | undefined>) {
  const results: unknown[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const response =
      (await apiClient.get<PaginatedTimelineResponse>(
        `${path}${buildQueryString({ ...params, page })}`,
      )) ?? emptyTimelineResponse();

    results.push(...(response.results ?? []));
    hasNext = Boolean(response.next);
    page += 1;
  }

  return results;
}

function normalizeTimelineFilters(filters: StoryFilters, yearFrom?: number, yearTo?: number) {
  const params: Record<string, string | number> = {};

  if (yearFrom !== undefined) {
    params.year_from = yearFrom;
  }

  if (yearTo !== undefined) {
    params.year_to = yearTo;
  }

  if (filters.locationBounds) {
    params.lat_min = filters.locationBounds.latMin;
    params.lat_max = filters.locationBounds.latMax;
    params.lng_min = filters.locationBounds.lngMin;
    params.lng_max = filters.locationBounds.lngMax;
  }

  const firstTag = getSelectedTags(filters)[0];

  if (firstTag) {
    params.tag = firstTag;
  }

  return params;
}

function normalizeFallbackFilters(filters: StoryFilters, yearFrom?: number, yearTo?: number) {
  const params = normalizeTimelineFilters(filters, yearFrom, yearTo);

  if (filters.q?.trim()) {
    params.q = filters.q.trim();
  }

  if (!filters.locationBounds && filters.location?.trim()) {
    params.location = filters.location.trim();
  }

  return params;
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const query = searchParams.toString();

  return query ? `?${query}` : '';
}

function storyMatchesFallbackFilters(
  story: unknown,
  filters: StoryFilters,
  yearFrom?: number,
  yearTo?: number,
) {
  if (!story || typeof story !== 'object') {
    return false;
  }

  const record = story as Record<string, unknown>;
  const selectedTags = getSelectedTags(filters);

  if (selectedTags.length && !storyHasTagsWhenAvailable(record, selectedTags)) {
    return false;
  }

  if (filters.q?.trim()) {
    const query = filters.q.trim().toLowerCase();
    const searchable = [
      asString(record.title),
      asString(record.location_name),
      asString(record.locationName),
      asString(record.preview_text),
      asString(record.previewText),
      asString(record.narrative),
    ]
      .join(' ')
      .toLowerCase();

    if (!searchable.includes(query)) {
      return false;
    }
  }

  if (filters.locationBounds) {
    if (!isRecordWithinBounds(record, filters.locationBounds)) {
      return false;
    }
  } else if (filters.location?.trim()) {
    const location = filters.location.trim().toLowerCase();
    const placeName = [asString(record.location_name), asString(record.locationName), asString(record.placeName)]
      .join(' ')
      .toLowerCase();

    if (!placeName.includes(location)) {
      return false;
    }
  }

  const proximity = getProximityFilter(filters);

  if (proximity && !isRecordWithinRadius(record, proximity)) {
    return false;
  }

  return isRecordWithinYearWindow(record, yearFrom, yearTo);
}

function getSelectedTags(filters: StoryFilters) {
  return (filters.tags ?? [])
    .map((tag) => tag.trim())
    .filter((tag, index, tags): tag is string => tag.length > 0 && tags.indexOf(tag) === index);
}

function recordHasTagField(story: unknown) {
  if (!story || typeof story !== 'object') {
    return false;
  }

  const record = story as Record<string, unknown>;

  return Array.isArray(record.tags) || Array.isArray(record.tag_names);
}

function getTagNames(story: Record<string, unknown>) {
  const rawTags = Array.isArray(story.tags)
    ? story.tags
    : Array.isArray(story.tag_names)
      ? story.tag_names
      : [];

  return rawTags
    .map((tag) => {
      if (typeof tag === 'string') {
        return tag.trim();
      }

      if (tag && typeof tag === 'object') {
        const tagRecord = tag as Record<string, unknown>;

        if (typeof tagRecord.name === 'string') {
          return tagRecord.name.trim();
        }

        if (typeof tagRecord.label === 'string') {
          return tagRecord.label.trim();
        }

        if (typeof tagRecord.slug === 'string') {
          return tagRecord.slug.trim();
        }
      }

      return '';
    })
    .filter((tag): tag is string => Boolean(tag));
}

function storyHasTagsWhenAvailable(story: Record<string, unknown>, selectedTags: string[]) {
  if (!selectedTags.length || !recordHasTagField(story)) {
    return true;
  }

  const tagNames = getTagNames(story).map((tag) => tag.toLowerCase());

  return selectedTags.every((tag) => tagNames.includes(tag.toLowerCase()));
}

function isRecordWithinYearWindow(record: Record<string, unknown>, yearFrom?: number, yearTo?: number) {
  if (yearFrom === undefined && yearTo === undefined) {
    return true;
  }

  const interval = getRecordYearInterval(record);

  if (!interval) {
    return true;
  }

  if (yearFrom !== undefined && interval.end < yearFrom) {
    return false;
  }

  if (yearTo !== undefined && interval.start > yearTo) {
    return false;
  }

  return true;
}

function getRecordYearInterval(record: Record<string, unknown>) {
  const timeType = asString(record.time_type) || asString(record.timeType);
  const year = asNumber(record.year);
  const yearStart = asNumber(record.year_start) ?? asNumber(record.yearStart);
  const yearEnd = asNumber(record.year_end) ?? asNumber(record.yearEnd);
  const dateValue = asString(record.date_value) || asString(record.dateValue);
  const dateYear = dateValue ? asNumber(dateValue.slice(0, 4)) : undefined;

  switch (timeType) {
    case 'decade':
      return year !== undefined ? { start: year, end: year + 9 } : undefined;
    case 'year_range':
      return yearStart !== undefined && yearEnd !== undefined
        ? { start: Math.min(yearStart, yearEnd), end: Math.max(yearStart, yearEnd) }
        : undefined;
    case 'exact_date':
      return dateYear !== undefined ? { start: dateYear, end: dateYear } : undefined;
    default:
      return year !== undefined ? { start: year, end: year } : undefined;
  }
}

function isRecordWithinBounds(
  record: Record<string, unknown>,
  bounds: NonNullable<StoryFilters['locationBounds']>,
) {
  const latitude = asNumber(record.location_lat) ?? asNumber(record.locationLat) ?? asNumber(record.latitude);
  const longitude = asNumber(record.location_lng) ?? asNumber(record.locationLng) ?? asNumber(record.longitude);

  return (
    latitude !== undefined &&
    longitude !== undefined &&
    latitude >= bounds.latMin &&
    latitude <= bounds.latMax &&
    longitude >= bounds.lngMin &&
    longitude <= bounds.lngMax
  );
}

function getProximityFilter(filters: StoryFilters) {
  if (
    filters.latitude === undefined ||
    filters.longitude === undefined ||
    filters.radiusKm === undefined
  ) {
    return undefined;
  }

  return {
    latitude: filters.latitude,
    longitude: filters.longitude,
    radiusKm: filters.radiusKm,
  };
}

function isRecordWithinRadius(
  record: Record<string, unknown>,
  proximity: { latitude: number; longitude: number; radiusKm: number },
) {
  const latitude = asNumber(record.location_lat) ?? asNumber(record.locationLat) ?? asNumber(record.latitude);
  const longitude = asNumber(record.location_lng) ?? asNumber(record.locationLng) ?? asNumber(record.longitude);

  if (latitude === undefined || longitude === undefined) {
    return false;
  }

  return haversineKm(proximity.latitude, proximity.longitude, latitude, longitude) <= proximity.radiusKm;
}

function haversineKm(startLat: number, startLng: number, endLat: number, endLng: number) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(endLat - startLat);
  const deltaLng = toRadians(endLng - startLng);
  const startLatRad = toRadians(startLat);
  const endLatRad = toRadians(endLat);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLatRad) * Math.cos(endLatRad) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
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
