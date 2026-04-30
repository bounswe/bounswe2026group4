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
});
