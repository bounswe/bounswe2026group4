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

    expect(getSpy).toHaveBeenCalledWith('/stories/search/?page=1&page_size=10&sort_by=recent&q=harbor');
  });

  it('sends popular sorting to the feed endpoint', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });

    await feedRemoteSource.getFeed({
      page: 1,
      sort: 'popular',
      filters: {},
    });

    expect(getSpy).toHaveBeenCalledWith('/stories/feed/?page=1&page_size=10&sort_by=popular');
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

  it('hydrates missing feed interaction metadata from story detail', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockImplementation(async (url) => {
      if (url === '/stories/feed/?page=1&page_size=10&sort_by=recent') {
        return {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 'story-1',
              title: 'Legacy Feed Story',
              user_has_saved: false,
            },
          ],
        };
      }

      if (url === '/stories/story-1/') {
        return {
          id: 'story-1',
          like_count: 4,
          save_count: 2,
          user_has_liked: true,
          user_has_saved: true,
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const response = await feedRemoteSource.getFeed({
      page: 1,
      sort: 'recent',
      filters: {},
    });

    expect(getSpy).toHaveBeenCalledWith('/stories/feed/?page=1&page_size=10&sort_by=recent');
    expect(getSpy).toHaveBeenCalledWith('/stories/story-1/');
    expect(response.results?.[0]).toMatchObject({
      id: 'story-1',
      like_count: 4,
      save_count: 2,
      user_has_liked: true,
      user_has_saved: true,
    });
  });

  it('does not hydrate interaction metadata when the feed already includes counts', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 'story-1',
          title: 'Current Feed Story',
          like_count: 4,
        },
      ],
    });

    const response = await feedRemoteSource.getFeed({});

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(response.results?.[0]).toMatchObject({ like_count: 4 });
  });

  it('sends bounding box params instead of text location when location was geocoded', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });

    await feedRemoteSource.getFeed({
      page: 1,
      sort: 'recent',
      filters: {
        location: 'Istanbul',
        locationBounds: {
          latMin: 40.8027,
          latMax: 41.3208,
          lngMin: 28.0065,
          lngMax: 29.4564,
        },
      },
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/stories/feed/?page=1&page_size=10&sort_by=recent&lat_min=40.8027&lat_max=41.3208&lng_min=28.0065&lng_max=29.4564',
    );
  });

  it('sends proximity params when radius filtering is active', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });

    await feedRemoteSource.getFeed({
      page: 1,
      sort: 'recent',
      filters: {
        latitude: 41.0082,
        longitude: 28.9784,
        radiusKm: 10,
      },
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/stories/feed/?page=1&page_size=10&sort_by=recent&latitude=41.0082&longitude=28.9784&radius_km=10',
    );
  });

  it('sends the first selected tag using the backend tag parameter', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });

    await feedRemoteSource.getFeed({
      page: 1,
      sort: 'recent',
      filters: { tags: ['folklore', 'ottoman-era'] },
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/stories/feed/?page=1&page_size=10&sort_by=recent&tag=folklore',
    );
  });

  it('filters by the first selected tag when the backend ignores tag but returns tag fields', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: [
        { id: 1, title: 'Untagged story', tags: [] },
        { id: 2, title: 'Tagged story', tags: [{ name: 'folklore' }] },
      ],
    });

    const response = await feedRemoteSource.getFeed({
      filters: { tags: ['folklore'] },
    });

    expect(response).toMatchObject({
      count: 1,
      next: null,
      results: [{ id: 2, title: 'Tagged story' }],
    });
  });

  it('fetches all feed pages before local tag filtering when the backend ignores paginated tag requests', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockImplementation(async (url) => {
      if (url === '/stories/feed/?page=1&page_size=10&sort_by=recent&tag=architecture') {
        return {
          count: 3,
          next: 'https://example.test/stories/feed/?page=2',
          previous: null,
          results: [{ id: 1, tags: [] }],
        };
      }

      if (url === '/stories/feed/?page_size=100&sort_by=recent&tag=architecture&page=1') {
        return {
          next: 'https://example.test/stories/feed/?page=2',
          results: [
            { id: 1, tags: [] },
            { id: 2, tags: [{ name: 'architecture' }] },
          ],
        };
      }

      if (url === '/stories/feed/?page_size=100&sort_by=recent&tag=architecture&page=2') {
        return {
          next: null,
          results: [
            { id: 3, tags: [{ name: 'art' }] },
            { id: 4, tags: [{ name: 'architecture' }] },
          ],
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const response = await feedRemoteSource.getFeed({
      filters: { tags: ['architecture'] },
    });

    expect(getSpy).toHaveBeenCalledWith('/stories/feed/?page=1&page_size=10&sort_by=recent&tag=architecture');
    expect(response).toMatchObject({
      count: 2,
      next: null,
      results: [{ id: 2 }, { id: 4 }],
    });
  });

  it('does not drop tag-filtered feed results when the backend omits tag fields', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [{ id: 1, title: 'Tagged story' }],
    });

    const response = await feedRemoteSource.getFeed({
      filters: { tags: ['folklore', 'ottoman-era'] },
    });

    expect(response).toMatchObject({
      count: 1,
      results: [{ id: 1, title: 'Tagged story' }],
    });
  });

  it('refines extra selected tags when feed results include tag fields', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: [
        { id: 1, title: 'Full match', tags: [{ name: 'folklore' }, { name: 'ottoman-era' }] },
        { id: 2, title: 'Partial match', tags: [{ name: 'folklore' }] },
      ],
    });

    const response = await feedRemoteSource.getFeed({
      filters: { tags: ['folklore', 'ottoman-era'] },
    });

    expect(response).toMatchObject({
      count: 1,
      results: [{ id: 1, title: 'Full match' }],
    });
  });

  it('filters feed results by geocoded bounds when the backend ignores bbox params', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          location_lat: '41.0082',
          location_lng: '28.9784',
        },
        {
          id: 2,
          location_lat: '39.9334',
          location_lng: '32.8597',
        },
      ],
    });

    const response = await feedRemoteSource.getFeed({
      filters: {
        location: 'Ankara',
        locationBounds: {
          latMin: 39.7,
          latMax: 40.1,
          lngMin: 32.5,
          lngMax: 33.2,
        },
      },
    });

    expect(response).toMatchObject({
      count: 1,
      next: null,
      results: [{ id: 2 }],
    });
  });

  it('filters feed results by radius when the backend ignores proximity params', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          location_lat: '41.0082',
          location_lng: '28.9784',
        },
        {
          id: 2,
          location_lat: '39.9334',
          location_lng: '32.8597',
        },
      ],
    });

    const response = await feedRemoteSource.getFeed({
      filters: {
        latitude: 41.0082,
        longitude: 28.9784,
        radiusKm: 1,
      },
    });

    expect(response).toMatchObject({
      count: 1,
      next: null,
      results: [{ id: 1 }],
    });
  });
});
