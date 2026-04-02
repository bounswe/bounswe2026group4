import { FeedRepositoryImpl } from '../../data/repositories';
import { FeedPageEntity } from '../../domain/entities';
import { FeedRequest } from '../../domain/repositories';

const repository = new FeedRepositoryImpl();

export const feedService = {
  async getFeed(request: FeedRequest = {}): Promise<FeedPageEntity> {
    return repository.getFeed(request);
  },
};
