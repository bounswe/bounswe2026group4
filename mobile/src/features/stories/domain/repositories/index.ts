import { StoryEntity, StoryMapPin, StorySummaryEntity } from '../entities';

export interface StoryFilters {
  q?: string;
  yearFrom?: number;
  yearTo?: number;
  location?: string;
}

export interface StoryRepository {
  getStory(id: string): Promise<StoryEntity | null>;
  getStories(filters?: StoryFilters): Promise<StorySummaryEntity[]>;
  getMapPins(filters?: StoryFilters): Promise<StoryMapPin[]>;
}
