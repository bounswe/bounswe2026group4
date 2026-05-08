import { apiClient } from '../../../../core/api/client';

export type AdminReportStatus = 'pending' | 'resolved';
export type AdminReportAction = 'no_action' | 'remove_content' | 'ban_user';

export interface AdminPage<T> {
  items: T[];
  page: number;
  totalCount: number;
  hasNextPage: boolean;
}

export interface AdminUserSummary {
  id: string;
  username: string;
  email?: string;
}

export interface AdminReport {
  id: string;
  reporter: AdminUserSummary;
  targetType: string;
  targetId: string;
  targetStoryId?: string;
  reason: string;
  description?: string;
  status: AdminReportStatus;
  createdAt: string;
  resolvedAt?: string | null;
  resolutionOutcome?: string | null;
}

export interface AdminStory {
  id: string;
  title: string;
  contributorName?: string | null;
  locationName?: string | null;
  status?: string;
  submittedAt?: string | null;
}

export interface AdminTag {
  id: string;
  name: string;
  storyCount: number;
}

type PaginatedResponse = {
  count?: number;
  next?: string | null;
  results?: unknown[];
};

const PAGE_SIZE = 10;
const COMMENT_STORY_LOOKUP_PAGE_SIZE = 100;
const MAX_COMMENT_STORY_LOOKUP_PAGES = 20;
const commentStoryIdCache = new Map<string, string>();

export const adminService = {
  async getReports({ page = 1, status }: { page?: number; status?: AdminReportStatus | 'all' } = {}): Promise<AdminPage<AdminReport>> {
    const query = buildQuery({ page, page_size: PAGE_SIZE, status: status && status !== 'all' ? status : undefined });
    const response = await getPage(`/moderation/reports/${query}`);

    const reportsPage = mapPage(response, page, mapReport);

    return {
      ...reportsPage,
      items: await hydrateCommentReportStoryIds(reportsPage.items),
    };
  },

  async resolveReport(reportId: string, action: AdminReportAction, note = ''): Promise<AdminReport> {
    const resolutionNote = [formatAction(action), note.trim()].filter(Boolean).join(' - ');
    const response = await apiClient.patch<Record<string, unknown>>(
      `/moderation/reports/${reportId}/resolve/`,
      {
        action,
        resolution_note: resolutionNote,
      },
    );

    if (!response) {
      throw new Error('Report resolution did not return a report.');
    }

    return mapReport(response);
  },

  async getStories({ page = 1, query = '' }: { page?: number; query?: string } = {}): Promise<AdminPage<AdminStory>> {
    const endpoint = query.trim() ? '/stories/search/' : '/stories/';
    const response = await getPage(`${endpoint}${buildQuery({ page, page_size: PAGE_SIZE, q: query.trim() || undefined })}`);

    return mapPage(response, page, mapStory);
  },

  async removeStory(storyId: string, reason: string): Promise<void> {
    await apiClient.delete<void>(`/moderation/stories/${storyId}/`, {
      data: {
        moderation_reason: reason,
      },
    });
  },

  async banUser(userId: string): Promise<void> {
    await apiClient.patch<void>(`/moderation/users/${userId}/ban/`);
  },

  async getTags({ page = 1, query = '' }: { page?: number; query?: string } = {}): Promise<AdminPage<AdminTag>> {
    const response = await getPage(`/tags/${buildQuery({ page, page_size: PAGE_SIZE, q: query.trim() || undefined })}`);

    return mapPage(response, page, mapTag);
  },

  async removeTag(tagId: string): Promise<void> {
    await apiClient.delete<void>(`/moderation/tags/${tagId}/`);
  },
};

export const moderationService = adminService;

async function getPage(path: string): Promise<PaginatedResponse> {
  const response = await apiClient.get<PaginatedResponse | unknown[]>(path);

  if (Array.isArray(response)) {
    return {
      count: response.length,
      next: null,
      results: response,
    };
  }

  return (response as PaginatedResponse | null) ?? {
    count: 0,
    next: null,
    results: [],
  };
}

function mapPage<T>(response: PaginatedResponse, page: number, mapper: (item: unknown) => T): AdminPage<T> {
  const items = (response.results ?? []).map(mapper);

  return {
    items,
    page,
    totalCount: response.count ?? items.length,
    hasNextPage: Boolean(response.next),
  };
}

async function hydrateCommentReportStoryIds(reports: AdminReport[]) {
  const missingCommentIds = Array.from(
    new Set(
      reports
        .filter((report) => report.targetType === 'comment' && !report.targetStoryId)
        .map((report) => report.targetId)
        .filter(Boolean),
    ),
  );

  const unresolvedCommentIds = missingCommentIds.filter((commentId) => !commentStoryIdCache.has(commentId));

  if (unresolvedCommentIds.length) {
    const resolved = await resolveStoryIdsForComments(unresolvedCommentIds);

    resolved.forEach((storyId, commentId) => {
      commentStoryIdCache.set(commentId, storyId);
    });
  }

  return reports.map((report) => {
    if (report.targetType !== 'comment' || report.targetStoryId) {
      return report;
    }

    const targetStoryId = commentStoryIdCache.get(report.targetId);

    return targetStoryId ? { ...report, targetStoryId } : report;
  });
}

async function resolveStoryIdsForComments(commentIds: string[]) {
  const unresolved = new Set(commentIds);
  const resolved = new Map<string, string>();
  let page = 1;
  let hasNext = true;

  while (hasNext && unresolved.size > 0 && page <= MAX_COMMENT_STORY_LOOKUP_PAGES) {
    const storiesResponse = await getPage(
      `/stories/feed/${buildQuery({
        page,
        page_size: COMMENT_STORY_LOOKUP_PAGE_SIZE,
        sort_by: 'recent',
      })}`,
    );

    const storyIds = (storiesResponse.results ?? [])
      .map(getRecordId)
      .filter((storyId): storyId is string => Boolean(storyId));

    await Promise.all(
      storyIds.map(async (storyId) => {
        if (!unresolved.size) {
          return;
        }

        const comments = await fetchStoryCommentsForLookup(storyId);

        comments.forEach((comment) => {
          const commentId = getRecordId(comment);

          if (commentId && unresolved.has(commentId)) {
            resolved.set(commentId, storyId);
            unresolved.delete(commentId);
          }
        });
      }),
    );

    hasNext = Boolean(storiesResponse.next);
    page += 1;
  }

  return resolved;
}

async function fetchStoryCommentsForLookup(storyId: string) {
  const comments: unknown[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const response = await getPage(
      `/stories/${storyId}/comments/${buildQuery({
        page,
        page_size: COMMENT_STORY_LOOKUP_PAGE_SIZE,
      })}`,
    );

    comments.push(...(response.results ?? []));
    hasNext = Boolean(response.next);
    page += 1;
  }

  return comments;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const query = searchParams.toString();

  return query ? `?${query}` : '';
}

function mapReport(item: unknown): AdminReport {
  const record = asRecord(item);
  const reporter = asRecord(record.reporter);

  return {
    id: asString(record.id),
    reporter: {
      id: asString(reporter.id),
      username: asString(reporter.username, 'Unknown reporter'),
      email: optionalString(reporter.email),
    },
    targetType: asString(record.target_type ?? record.targetType, 'content'),
    targetId: asString(record.target_id ?? record.targetId),
    targetStoryId: optionalString(
      record.target_story_id ??
        record.targetStoryId ??
        record.story_id ??
        record.storyId ??
        asRecord(record.comment).story_id ??
        asRecord(record.comment).storyId,
    ),
    reason: asString(record.reason, 'Unspecified'),
    description: optionalString(record.description),
    status: normalizeReportStatus(record.status),
    createdAt: asString(record.created_at ?? record.createdAt),
    resolvedAt: optionalString(record.resolved_at ?? record.resolvedAt),
    resolutionOutcome: optionalString(record.resolution_outcome ?? record.resolutionOutcome),
  };
}

function mapStory(item: unknown): AdminStory {
  const record = asRecord(item);

  return {
    id: asString(record.id),
    title: asString(record.title, 'Untitled story'),
    contributorName: optionalString(record.contributor_name ?? record.contributorName),
    locationName: optionalString(record.location_name ?? record.locationName),
    status: optionalString(record.status),
    submittedAt: optionalString(record.submitted_at ?? record.submittedAt),
  };
}

function mapTag(item: unknown): AdminTag {
  const record = asRecord(item);

  return {
    id: asString(record.id),
    name: asString(record.name, 'untitled'),
    storyCount: asNumber(record.story_count ?? record.storyCount),
  };
}

function normalizeReportStatus(value: unknown): AdminReportStatus {
  if (value === 'resolved') {
    return value;
  }

  return 'pending';
}

function formatAction(action: AdminReportAction) {
  if (action === 'remove_content') {
    return 'Remove content';
  }

  if (action === 'ban_user') {
    return 'Ban user';
  }

  return 'No action';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getRecordId(value: unknown) {
  const record = asRecord(value);

  return asString(record.id);
}

function asString(value: unknown, fallback = '') {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return fallback;
}

function optionalString(value: unknown) {
  const resolved = asString(value);

  return resolved || undefined;
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}
