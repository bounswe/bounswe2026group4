import { StoryEntity, StoryMapPin, StorySummaryEntity } from '../../domain/entities';
import { StoryRepositoryImpl } from '../../data/repositories';
import { StoryFilters } from '../../domain/repositories';
import { feedService } from '../../../feed/application/services';
import { FeedPageEntity, FeedSortOption } from '../../../feed/domain/entities';
import { timelineService } from '../../../timeline/application/services';
import { TimelinePageEntity } from '../../../timeline/domain/entities';
import { TimelineRequest } from '../../../timeline/domain/repositories';

const repository = new StoryRepositoryImpl();

export const storyService = {
  async getStory(id: string): Promise<StoryEntity | null> {
    return repository.getStory(id);
  },
  async deleteStory(id: string): Promise<void> {
    return repository.deleteStory(id);
  },
  async getStories(filters?: StoryFilters): Promise<StorySummaryEntity[]> {
    return repository.getStories(filters);
  },
  async getMapPins(filters?: StoryFilters): Promise<StoryMapPin[]> {
    return repository.getMapPins(filters);
  },
  async getFeed({
    page,
    sort,
    filters,
  }: {
    page?: number;
    sort?: FeedSortOption;
    filters?: StoryFilters;
  } = {}): Promise<FeedPageEntity> {
    return feedService.getFeed({ page, sort, filters });
  },
  async getTimeline(request: TimelineRequest = {}): Promise<TimelinePageEntity> {
    return timelineService.getTimeline(request);
  },
};
