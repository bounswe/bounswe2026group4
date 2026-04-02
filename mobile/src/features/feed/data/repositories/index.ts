import { FeedPageEntity } from '../../domain/entities';
import { FeedRepository, FeedRequest } from '../../domain/repositories';
import { mapFeedPage } from '../mappers';
import { feedLocalSource, feedRemoteSource } from '../sources';

export class FeedRepositoryImpl implements FeedRepository {
  async getFeed(request: FeedRequest = {}): Promise<FeedPageEntity> {
    const page = request.page ?? 1;
    const response = await feedRemoteSource.getFeed(request);

    return mapFeedPage(response, page, feedLocalSource.pageSize);
  }
}
