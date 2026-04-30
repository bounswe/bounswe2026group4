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

    const proximity = getProximityFilter(filters);
    const bounds = filters.locationBounds;
    const selectedTags = filters.tags ?? [];

    if (!bounds && !proximity && !selectedTags.length) {
      return response;
    }

    const results = (response.results ?? []).filter((story) => {
      if (selectedTags.length && !storyHasTags(story, selectedTags)) {
        return false;
      }

      if (proximity && !isStoryWithinRadius(story, proximity)) {
        return false;
      }

      return bounds ? isStoryWithinBounds(story, bounds) : true;
    });

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

  if (filters.tags?.length) {
    params.tag = filters.tags[0];
  }

  const proximity = getProximityFilter(filters);

  if (proximity) {
    params.latitude = proximity.latitude;
    params.longitude = proximity.longitude;
    params.radius_km = proximity.radiusKm;
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

function storyHasTags(story: unknown, selectedTags: string[]) {
  if (!story || typeof story !== 'object') {
    return false;
  }

  const record = story as Record<string, unknown>;
  const rawTags = Array.isArray(record.tags)
    ? record.tags
    : Array.isArray(record.tag_names)
      ? record.tag_names
      : [];
  const tagNames = rawTags
    .map((tag) => {
      if (typeof tag === 'string') {
        return tag;
      }

      if (tag && typeof tag === 'object') {
        const tagRecord = tag as Record<string, unknown>;
        return typeof tagRecord.name === 'string'
          ? tagRecord.name
          : typeof tagRecord.label === 'string'
            ? tagRecord.label
            : typeof tagRecord.slug === 'string'
              ? tagRecord.slug
              : '';
      }

      return '';
    })
    .filter(Boolean)
    .map((tag) => tag.toLowerCase());

  return selectedTags.every((tag) => tagNames.includes(tag.toLowerCase()));
}

function hasProximityFilter(filters: StoryFilters) {
  return (
    filters.latitude !== undefined &&
    filters.longitude !== undefined &&
    filters.radiusKm !== undefined
  );
}

function getProximityFilter(filters: StoryFilters) {
  if (!hasProximityFilter(filters)) {
    return undefined;
  }

  return {
    latitude: filters.latitude as number,
    longitude: filters.longitude as number,
    radiusKm: filters.radiusKm as number,
  };
}

function isStoryWithinRadius(
  story: unknown,
  proximity: { latitude: number; longitude: number; radiusKm: number },
) {
  if (!story || typeof story !== 'object') {
    return false;
  }

  const record = story as Record<string, unknown>;
  const latitude = asNumber(record.location_lat);
  const longitude = asNumber(record.location_lng);

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
