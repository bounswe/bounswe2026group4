import { feedRemoteSource } from '..';
import { apiClient } from '../../../../../core/api/client';

describe('feedRemoteSource', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the search endpoint when a text query is provided', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });

    await feedRemoteSource.getFeed({
      page: 1,
      sort: 'recent',
      filters: { q: 'harbor' },
    });

    expect(getSpy).toHaveBeenCalledWith('/stories/search/?page=1&page_size=10&q=harbor');
  });

  it('uses the feed endpoint when no text query is provided', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });

    await feedRemoteSource.getFeed({
      page: 2,
      sort: 'recent',
      filters: { location: 'Istanbul' },
    });

    expect(getSpy).toHaveBeenCalledWith('/stories/feed/?page=2&page_size=10&sort_by=recent&location=Istanbul');
  });
});
