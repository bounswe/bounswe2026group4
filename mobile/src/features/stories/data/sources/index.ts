import { apiClient } from '../../../../core/api/client';
import { StoryEntity } from '../../domain/entities';
import { StoryFilters } from '../../domain/repositories';

const storiesFixture: StoryEntity[] = [];

export const storiesRemoteSource = {
  async getStory(id: string) {
    return storiesFixture.find((story) => story.id === id) ?? null;
  },

  async getStories(filters: StoryFilters = {}) {
    if (!filters.q?.trim()) {
      return storiesLocalSource.getStories(filters);
    }

    const stories = storiesLocalSource.getStories(filters);
    const query = filters.q.trim().toLowerCase();

    return stories.filter((story) => {
      const searchableText = [story.title, story.location.name, story.timePeriod, ...story.narrative]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  },

  async getStoriesFromApi(filters: StoryFilters = {}) {
    const hasSearch = Boolean(filters.q?.trim());
    const path = hasSearch ? '/stories/search/' : '/stories/feed/';
    const pageParams = hasSearch ? { page_size: 100 } : { page: 1, page_size: 100, sort_by: 'recent' };

    return (
      await apiClient.get<{ results?: unknown[] }>(
        `${path}${buildQueryString({ ...pageParams, ...normalizeStoryFilters(filters) })}`,
      )
    )?.results ?? [];
  },

  async getMapStoriesFromApi(filters: StoryFilters = {}) {
    const hasSearch = Boolean(filters.q?.trim());
    const path = hasSearch ? '/stories/search/' : '/stories/map/';
    const params = hasSearch ? { page_size: 100, ...normalizeStoryFilters(filters) } : normalizeStoryFilters(filters);

    return (await apiClient.get<{ results?: unknown[] }>(`${path}${buildQueryString(params)}`))?.results ?? [];
  },
};

export const storiesLocalSource = {
  getStories(filters: StoryFilters = {}) {
    return storiesFixture.filter((story) => {
      if (filters.location?.trim()) {
        const normalizedLocation = filters.location.trim().toLowerCase();
        if (!story.location.name.toLowerCase().includes(normalizedLocation)) {
          return false;
        }
      }

      if (filters.yearFrom || filters.yearTo) {
        const years = story.timePeriod.match(/\d{4}/g)?.map((year) => Number(year)) ?? [];
        const minYear = years.length ? Math.min(...years) : undefined;
        const maxYear = years.length ? Math.max(...years) : undefined;

        if (filters.yearFrom && maxYear !== undefined && maxYear < filters.yearFrom) {
          return false;
        }

        if (filters.yearTo && minYear !== undefined && minYear > filters.yearTo) {
          return false;
        }
      }

      return true;
    });
  },
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
