import { StoryEntity } from '../entities';

export interface StoryRepository {
  getStory(id: string): Promise<StoryEntity | null>;
}
