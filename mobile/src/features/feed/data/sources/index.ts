import { apiClient } from '../../../../core/api/client';
import { StoryFilters } from '../../../stories/domain/repositories';
import { FeedSortOption } from '../../domain/entities';

const DEFAULT_PAGE_SIZE = 10;
const TAG_FALLBACK_PAGE_SIZE = 100;

type FeedPageResponse = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: unknown[];
};

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
    const endpoint = hasSearch ? '/stories/search/' : '/stories/feed/';
    const normalizedFilters = normalizeStoryFilters(filters);
    const params = buildQueryString({
      page,
      page_size: DEFAULT_PAGE_SIZE,
      sort_by: sort,
      ...normalizedFilters,
    });

    const response = (await apiClient.get<FeedPageResponse>(`${endpoint}${params}`)) ?? {
      count: 0,
      next: null,
      previous: null,
      results: [],
    };

    const proximity = getProximityFilter(filters);
    const bounds = filters.locationBounds;
    const responseResults = response.results ?? [];
    const selectedTags = getSelectedTags(filters);
    const canFilterTagsLocally = selectedTags.length > 0 && responseResults.some(recordHasTagField);
    const needsCompleteTagSet =
      canFilterTagsLocally &&
      (Boolean(response.next) || (response.count ?? 0) > responseResults.length);

    const resultsToFilter = needsCompleteTagSet
      ? await fetchAllFeedResults(endpoint, {
          page_size: TAG_FALLBACK_PAGE_SIZE,
          sort_by: sort,
          ...normalizedFilters,
        })
      : responseResults;

    if (!bounds && !proximity && !canFilterTagsLocally) {
      return {
        ...response,
        results: await hydrateMissingInteractionMetadata(responseResults),
      };
    }

    const filtered = resultsToFilter.filter((story) => {
      if (canFilterTagsLocally && !storyHasTagsWhenAvailable(story, selectedTags)) {
        return false;
      }
      if (proximity && !isStoryWithinRadius(story, proximity)) {
        return false;
      }

      return bounds ? isStoryWithinBounds(story, bounds) : true;
    });
    const pageResults = needsCompleteTagSet
      ? filtered.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE)
      : filtered;
    const hydratedResults = await hydrateMissingInteractionMetadata(pageResults);

    return {
      ...response,
      count: filtered.length,
      next: needsCompleteTagSet && page * DEFAULT_PAGE_SIZE < filtered.length ? 'local-tag-filter' : null,
      results: hydratedResults,
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
    const firstTag = filters.tags.find((tag) => tag.trim().length > 0);

    if (firstTag) {
      params.tag = firstTag.trim();
    }
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

async function fetchAllFeedResults(
  path: string,
  params: Record<string, string | number | undefined>,
) {
  const results: unknown[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const response =
      (await apiClient.get<FeedPageResponse>(
        `${path}${buildQueryString({ ...params, page })}`,
      )) ?? {};

    results.push(...(response.results ?? []));
    hasNext = Boolean(response.next);
    page += 1;
  }

  return results;
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

async function hydrateMissingInteractionMetadata(results: unknown[]) {
  return Promise.all(
    results.map(async (story) => {
      if (!shouldHydrateInteractionMetadata(story)) {
        return story;
      }

      const record = story as Record<string, unknown>;
      const id = typeof record.id === 'string' || typeof record.id === 'number' ? String(record.id) : undefined;

      if (!id) {
        return story;
      }

      try {
        const detail = await apiClient.get<Record<string, unknown>>(`/stories/${id}/`);

        if (!detail || typeof detail !== 'object') {
          return story;
        }

        return {
          ...record,
          like_count: detail.like_count ?? detail.likeCount ?? record.like_count,
          save_count: detail.save_count ?? detail.saveCount ?? record.save_count,
          user_has_liked: detail.user_has_liked ?? detail.likedByViewer ?? record.user_has_liked,
          user_has_saved: detail.user_has_saved ?? detail.savedByViewer ?? record.user_has_saved,
        };
      } catch {
        return story;
      }
    }),
  );
}

function shouldHydrateInteractionMetadata(story: unknown) {
  if (!story || typeof story !== 'object') {
    return false;
  }

  const record = story as Record<string, unknown>;
  const hasStoryCardShape = typeof record.title === 'string';

  return (
    hasStoryCardShape &&
    record.like_count === undefined &&
    record.likeCount === undefined &&
    record.likes_count === undefined &&
    record.total_likes === undefined
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

function storyHasTagsWhenAvailable(story: unknown, selectedTags: string[]) {
  if (!selectedTags.length) {
    return true;
  }

  if (!recordHasTagField(story)) {
    return true;
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
