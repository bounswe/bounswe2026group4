import { StoryFilters } from '../../../stories/domain/repositories';
import { TimelineEntity } from '../../domain/entities';
import { TimelineRequest } from '../../domain/repositories';

export interface TimelineUiState {
  items: TimelineEntity[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasNextPage: boolean;
  filters: StoryFilters;
  periodRequest: TimelineRequest;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error?: string;
}

export function createInitialTimelineUiState(
  filters: StoryFilters = {},
  periodRequest: TimelineRequest = {},
): TimelineUiState {
  return {
    items: [],
    page: 1,
    pageSize: 10,
    totalCount: 0,
    hasNextPage: false,
    filters,
    periodRequest,
    isLoading: false,
    isRefreshing: false,
    isLoadingMore: false,
    error: undefined,
  };
}
