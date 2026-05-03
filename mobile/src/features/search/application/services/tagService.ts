import { apiClient } from '../../../../core/api/client';

export interface SearchTag {
  id: string;
  name: string;
  storyCount?: number;
}

interface TagRecord {
  id?: unknown;
  name?: unknown;
  story_count?: unknown;
  storyCount?: unknown;
}

export async function searchTags(query = ''): Promise<SearchTag[]> {
  const trimmedQuery = query.trim();
  const params = new URLSearchParams();

  if (trimmedQuery) {
    params.append('q', trimmedQuery);
  }

  const response = await apiClient.get<unknown>(`/tags/${params.toString() ? `?${params.toString()}` : ''}`);
  const values = Array.isArray(response)
    ? response
    : response && typeof response === 'object' && Array.isArray((response as { results?: unknown[] }).results)
      ? (response as { results: unknown[] }).results
      : [];

  return values.map(mapTag).filter((tag): tag is SearchTag => Boolean(tag));
}

function mapTag(value: unknown): SearchTag | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const tag = value as TagRecord;
  const id = typeof tag.id === 'string' || typeof tag.id === 'number' ? String(tag.id) : undefined;
  const name = typeof tag.name === 'string' ? tag.name.trim() : '';
  const storyCount =
    typeof tag.story_count === 'number'
      ? tag.story_count
      : typeof tag.storyCount === 'number'
        ? tag.storyCount
        : undefined;

  return id && name ? { id, name, storyCount } : null;
}
