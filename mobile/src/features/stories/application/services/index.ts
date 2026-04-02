import { StoryEntity, StoryMapPin, StorySummaryEntity } from '../../domain/entities';
import { StoryRepositoryImpl } from '../../data/repositories';
import { StoryFilters } from '../../domain/repositories';

const repository = new StoryRepositoryImpl();

export const storyService = {
  async getStory(id: string): Promise<StoryEntity | null> {
    return repository.getStory(id);
  },
  async getStories(filters?: StoryFilters): Promise<StorySummaryEntity[]> {
    return repository.getStories(filters);
  },
  async getMapPins(filters?: StoryFilters): Promise<StoryMapPin[]> {
    return repository.getMapPins(filters);
  },
};
