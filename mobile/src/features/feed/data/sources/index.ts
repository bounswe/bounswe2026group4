import { apiClient } from '../../../../core/api/client';
import { StoryFilters } from '../../../stories/domain/repositories';
import { FeedSortOption } from '../../domain/entities';

const DEFAULT_PAGE_SIZE = 10;

export const feedRemoteSource = {
  async getFeed({
    page = 1,
    sort = 'recent',
    filters = {},
  }: {
    page?: number;
    sort?: FeedSortOption;
    filters?: StoryFilters;
  }) {
    const hasSearch = Boolean(filters.q?.trim());
    const params = buildQueryString({
      page,
      page_size: DEFAULT_PAGE_SIZE,
      ...(hasSearch ? {} : { sort_by: sort }),
      ...normalizeStoryFilters(filters),
    });

    const response = (await apiClient.get<{
      count?: number;
      next?: string | null;
      previous?: string | null;
      results?: unknown[];
    }>(`${hasSearch ? '/stories/search/' : '/stories/feed/'}${params}`)) ?? {
      count: 0,
      next: null,
      previous: null,
      results: [],
    };

    const bounds = filters.locationBounds;

    if (!bounds) {
      return response;
    }

    const results = (response.results ?? []).filter((story) => isStoryWithinBounds(story, bounds));

    return {
      ...response,
      count: results.length,
      next: null,
      results,
    };
  },
};

export const feedLocalSource = {
  pageSize: DEFAULT_PAGE_SIZE,
};

function normalizeStoryFilters(filters: StoryFilters) {
  const params: Record<string, string | number> = {};

  if (filters.q?.trim()) {
    params.q = filters.q.trim();
  }

  if (filters.yearFrom) {
    params.year_from = filters.yearFrom;
  }

  if (filters.yearTo) {
    params.year_to = filters.yearTo;
  }

  if (filters.locationBounds) {
    params.lat_min = filters.locationBounds.latMin;
    params.lat_max = filters.locationBounds.latMax;
    params.lng_min = filters.locationBounds.lngMin;
    params.lng_max = filters.locationBounds.lngMax;
  } else if (filters.location?.trim()) {
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

function isStoryWithinBounds(
  story: unknown,
  bounds: NonNullable<StoryFilters['locationBounds']>,
) {
  if (!story || typeof story !== 'object') {
    return false;
  }

  const record = story as Record<string, unknown>;
  const latitude = asNumber(record.location_lat);
  const longitude = asNumber(record.location_lng);

  return (
    latitude !== undefined &&
    longitude !== undefined &&
    latitude >= bounds.latMin &&
    latitude <= bounds.latMax &&
    longitude >= bounds.lngMin &&
    longitude <= bounds.lngMax
  );
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
