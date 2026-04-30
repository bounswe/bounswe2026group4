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
      sort_by: sort,
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
    const responseResults = response.results ?? [];

    if (!bounds) {
      return {
        ...response,
        results: await hydrateMissingInteractionMetadata(responseResults),
      };
    }

    const results = responseResults.filter((story) => isStoryWithinBounds(story, bounds));
    const hydratedResults = await hydrateMissingInteractionMetadata(results);

    return {
      ...response,
      count: hydratedResults.length,
      next: null,
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
