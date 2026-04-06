import { feedService } from '..';
import { FeedRepositoryImpl } from '../../../data/repositories';

describe('feedService', () => {
  it('delegates getFeed to the repository', async () => {
    const response = {
      items: [],
      page: 1,
      pageSize: 10,
      totalCount: 0,
      hasNextPage: false,
    };
    const getFeedSpy = jest.spyOn(FeedRepositoryImpl.prototype, 'getFeed').mockResolvedValue(response);

    await feedService.getFeed({ page: 2, sort: 'recent', filters: { location: 'Istanbul' } });

    expect(getFeedSpy).toHaveBeenCalledWith({
      page: 2,
      sort: 'recent',
      filters: { location: 'Istanbul' },
    });

    getFeedSpy.mockRestore();
  });
});
