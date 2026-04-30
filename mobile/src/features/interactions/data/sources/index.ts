import { apiClient } from '../../../../core/api/client';

interface PaginatedResponse<T> {
  next?: string | null;
  results?: T[];
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

export const interactionsRemoteSource = {
  async getComments(storyId: string) {
    const comments: unknown[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const response =
        (await apiClient.get<PaginatedResponse<unknown>>(
          `/stories/${storyId}/comments/${buildQueryString({ page, page_size: 100 })}`,
        )) ?? {};

      comments.push(...(response.results ?? []));
      hasNext = Boolean(response.next);
      page += 1;
    }

    return comments;
  },

  async addComment(storyId: string, text: string) {
    const response = await apiClient.post<{ comment?: unknown }>(`/stories/${storyId}/comments/`, { text });
    return response?.comment ?? null;
  },

  async deleteComment(commentId: string) {
    await apiClient.delete(`/comments/${commentId}/`);
  },

  async likeStory(storyId: string) {
    await apiClient.post(`/stories/${storyId}/like/`);
  },

  async unlikeStory(storyId: string) {
    await apiClient.delete(`/stories/${storyId}/like/`);
  },

  async bookmarkStory(storyId: string) {
    await apiClient.post(`/stories/${storyId}/bookmark/`);
  },

  async unbookmarkStory(storyId: string) {
    await apiClient.delete(`/stories/${storyId}/bookmark/`);
  },
};

export const interactionsLocalSource = {};
