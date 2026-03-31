import { StoryEntity } from '../../domain/entities';
import { StoryRepositoryImpl } from '../../data/repositories';

const repository = new StoryRepositoryImpl();

export const storyService = {
  async getStory(id: string): Promise<StoryEntity | null> {
    return repository.getStory(id);
  },
};
