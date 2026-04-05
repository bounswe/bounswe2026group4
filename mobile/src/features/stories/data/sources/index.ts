import { apiClient } from '../../../../core/api/client';
import { StoryEntity } from '../../domain/entities';
import { StoryFilters } from '../../domain/repositories';

const storiesFixture: StoryEntity[] = [];
type StoryRecord = Record<string, unknown>;

export const storiesRemoteSource = {
  async getStory(id: string) {
    try {
      return (await apiClient.get(`/stories/${id}/`)) ?? storiesFixture.find((story) => story.id === id) ?? null;
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;

      if (status === 404) {
        return null;
      }

      throw error;
    }
  },

  async getStoryComments(id: string) {
    return (await apiClient.get<{ results?: unknown[] }>(`/stories/${id}/comments/`))?.results ?? [];
  },

  async deleteStory(id: string) {
    await apiClient.delete(`/stories/${id}/`);
  },

  async getStories(filters: StoryFilters = {}) {
    return storiesLocalSource.getStories(filters);
  },

  async getStoriesFromApi(filters: StoryFilters = {}) {
    if (!filters.q?.trim()) {
      return (
        await apiClient.get<{ results?: unknown[] }>(
          `/stories/feed/${buildQueryString({
            page: 1,
            page_size: 100,
            sort_by: 'recent',
            ...normalizeStoryFilters(filters),
          })}`,
        )
      )?.results ?? [];
    }

    const results = await fetchAllPages('/stories/search/', {
      q: filters.q.trim(),
      page_size: 100,
    });

    return filterRemoteStories(results, filters);
  },

  async getMapStoriesFromApi(filters: StoryFilters = {}) {
    if (!filters.q?.trim()) {
      return (
        await apiClient.get<{ results?: unknown[] }>(
          `/stories/map/${buildQueryString({
            page: 1,
            page_size: 100,
            ...normalizeStoryFilters(filters),
          })}`,
        )
      )?.results ?? [];
    }

    const results = await fetchAllPages('/stories/search/', {
      q: filters.q.trim(),
      page_size: 100,
    });

    return filterRemoteStories(results, filters).filter(hasCoordinates);
  },
};

export const storiesLocalSource = {
  getStories(filters: StoryFilters = {}) {
    return storiesFixture.filter((story) => {
      if (filters.q?.trim()) {
        const query = filters.q.trim().toLowerCase();
        const searchableText = [story.title, story.location.name, story.timePeriod, ...story.narrative]
          .join(' ')
          .toLowerCase();

        if (!searchableText.includes(query)) {
          return false;
        }
      }

      if (filters.location?.trim()) {
        const normalizedLocation = filters.location.trim().toLowerCase();
        if (!story.location.name.toLowerCase().includes(normalizedLocation)) {
          return false;
        }
      }

      if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
        const years = extractYearsFromString(story.timePeriod);
        const minYear = years.length ? Math.min(...years) : undefined;
        const maxYear = years.length ? Math.max(...years) : undefined;

        if (filters.yearFrom !== undefined && maxYear !== undefined && maxYear < filters.yearFrom) {
          return false;
        }

        if (filters.yearTo !== undefined && minYear !== undefined && minYear > filters.yearTo) {
          return false;
        }
      }

      return true;
    });
  },
};

async function fetchAllPages(
  path: string,
  params: Record<string, string | number | undefined>,
) {
  const results: unknown[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const response =
      (await apiClient.get<{ next?: string | null; results?: unknown[] }>(
        `${path}${buildQueryString({ ...params, page })}`,
      )) ?? {};

    results.push(...(response.results ?? []));
    hasNext = Boolean(response.next);
    page += 1;
  }

  return results;
}

function filterRemoteStories(results: unknown[], filters: StoryFilters) {
  return results.filter((value) => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const story = value as StoryRecord;
    const placeName = asString(story.location_name).toLowerCase();
    const title = asString(story.title).toLowerCase();
    const preview = asString(story.preview_text).toLowerCase();

    if (filters.q?.trim()) {
      const query = filters.q.trim().toLowerCase();

      if (!title.includes(query) && !placeName.includes(query) && !preview.includes(query)) {
        return false;
      }
    }

    if (filters.location?.trim()) {
      const location = filters.location.trim().toLowerCase();

      if (!placeName.includes(location)) {
        return false;
      }
    }

    if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
      const years = extractYearsFromRemoteStory(story);
      const minYear = years.length ? Math.min(...years) : undefined;
      const maxYear = years.length ? Math.max(...years) : undefined;

      if (filters.yearFrom !== undefined && maxYear !== undefined && maxYear < filters.yearFrom) {
        return false;
      }

      if (filters.yearTo !== undefined && minYear !== undefined && minYear > filters.yearTo) {
        return false;
      }
    }

    return true;
  });
}

function hasCoordinates(value: unknown) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const story = value as StoryRecord;
  return asNumber(story.location_lat) !== undefined && asNumber(story.location_lng) !== undefined;
}

function normalizeStoryFilters(filters: StoryFilters) {
  const params: Record<string, string | number> = {};

  if (filters.q?.trim()) {
    params.q = filters.q.trim();
  }

  if (filters.yearFrom !== undefined) {
    params.year_from = filters.yearFrom;
  }

  if (filters.yearTo !== undefined) {
    params.year_to = filters.yearTo;
  }

  if (filters.location?.trim()) {
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

function extractYearsFromRemoteStory(story: StoryRecord) {
  const years = [asNumber(story.year), asNumber(story.year_start), asNumber(story.year_end)].filter(
    (value): value is number => value !== undefined,
  );

  if (years.length > 0) {
    return years;
  }

  return extractYearsFromString(asString(story.timePeriod) || asString(story.time_period));
}

function extractYearsFromString(value: string) {
  return (value.match(/-?\d{1,4}/g) ?? [])
    .map((year) => Number(year))
    .filter((year) => Number.isFinite(year));
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}
