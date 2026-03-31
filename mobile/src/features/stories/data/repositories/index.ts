import { StoryEntity } from '../../domain/entities';
import { StoryRepository } from '../../domain/repositories';
import { mapStory } from '../mappers';
import { storiesRemoteSource } from '../sources';

export class StoryRepositoryImpl implements StoryRepository {
  async getStory(id: string): Promise<StoryEntity | null> {
    const response = await storiesRemoteSource.getStory(id);

    return response ? mapStory(response) : null;
  }
}
