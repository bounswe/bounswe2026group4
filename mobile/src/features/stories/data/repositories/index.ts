import { StoryEntity, StoryMapPin, StorySummaryEntity } from '../../domain/entities';
import { StoryFilters, StoryRepository } from '../../domain/repositories';
import { mapStory, mapStoryComment, mapStoryMapPin, mapStorySummary } from '../mappers';
import { storiesLocalSource, storiesRemoteSource } from '../sources';
import { env } from '../../../../app/config/env';

export class StoryRepositoryImpl implements StoryRepository {
  async getStory(id: string): Promise<StoryEntity | null> {
    const response = await storiesRemoteSource.getStory(id);

    if (!response) {
      return null;
    }

    try {
      const [story, comments] = await Promise.all([
        Promise.resolve(mapStory(response)),
        storiesRemoteSource.getStoryComments(id).catch(() => []),
      ]);

      return {
        ...story,
        comments: comments.map(mapStoryComment),
      };
    } catch {
      return mapStory(response);
    }
  }

  async getStories(filters: StoryFilters = {}): Promise<StorySummaryEntity[]> {
    try {
      const response = await storiesRemoteSource.getStoriesFromApi(filters);
      const remoteStories = response.map(mapStorySummary);

      if (env.environment === 'development') {
        return mergeById(remoteStories, storiesLocalSource.getStories(filters).map(mapStorySummary));
      }

      return remoteStories;
    } catch {
      const response = await storiesRemoteSource.getStories(filters);
      return response.map(mapStorySummary);
    }
  }

  async getMapPins(filters: StoryFilters = {}): Promise<StoryMapPin[]> {
    try {
      const response = await storiesRemoteSource.getMapStoriesFromApi(filters);
      const remotePins = response.map(mapStoryMapPin);

      if (env.environment === 'development') {
        return mergeById(remotePins, storiesLocalSource.getStories(filters).map(mapStoryMapPin));
      }

      return remotePins;
    } catch {
      const response = await storiesRemoteSource.getStories(filters);
      return response.map(mapStoryMapPin);
    }
  }
}

function mergeById<T extends { id: string }>(primary: T[], secondary: T[]) {
  const merged = new Map<string, T>();

  primary.forEach((item) => {
    merged.set(item.id, item);
  });

  secondary.forEach((item) => {
    if (!merged.has(item.id)) {
      merged.set(item.id, item);
    }
  });

  return Array.from(merged.values());
}
