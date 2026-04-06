import { StoryFilters } from '../../../stories/domain/repositories';
import { FeedPageEntity, FeedSortOption } from '../entities';

export interface FeedRequest {
  page?: number;
  sort?: FeedSortOption;
  filters?: StoryFilters;
}

export interface FeedRepository {
  getFeed(request?: FeedRequest): Promise<FeedPageEntity>;
}
