import { StoryFilters } from '../../../stories/domain/repositories';
import { FeedEntity, FeedSortOption } from '../../domain/entities';

export interface FeedUiState {
  items: FeedEntity[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error?: string;
  page: number;
  totalCount: number;
  hasNextPage: boolean;
  sort: FeedSortOption;
  filters: StoryFilters;
}

export function createInitialFeedUiState(filters: StoryFilters = {}): FeedUiState {
  return {
    items: [],
    isLoading: true,
    isRefreshing: false,
    isLoadingMore: false,
    error: undefined,
    page: 1,
    totalCount: 0,
    hasNextPage: false,
    sort: 'recent',
    filters,
  };
}
