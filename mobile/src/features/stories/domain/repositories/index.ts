import { StoryEntity, StoryMapPin, StorySummaryEntity } from '../entities';

export interface StoryFilters {
  q?: string;
  yearFrom?: number;
  yearTo?: number;
  location?: string;
  tags?: string[];
  locationBounds?: {
    latMin: number;
    latMax: number;
    lngMin: number;
    lngMax: number;
  };
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

export interface StoryRepository {
  getStory(id: string): Promise<StoryEntity | null>;
  deleteStory(id: string): Promise<void>;
  getStories(filters?: StoryFilters): Promise<StorySummaryEntity[]>;
  getMapPins(filters?: StoryFilters): Promise<StoryMapPin[]>;
}
