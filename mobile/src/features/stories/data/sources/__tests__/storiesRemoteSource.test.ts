import { storiesRemoteSource } from '..';
import { apiClient } from '../../../../../core/api/client';

describe('storiesRemoteSource', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('attaches preview text to GeoJSON features when the map endpoint omits it', async () => {
    const getSpy = jest.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 7,
            geometry: {
              type: 'Point',
              coordinates: [28.9784, 41.0082],
            },
            properties: {
              title: 'Bosphorus Memory',
              location_name: 'Istanbul',
              time_type: 'decade',
              year: 1980,
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        next: null,
        results: [
          {
            id: 7,
            preview_text: 'A waterfront story.',
          },
        ],
      });

    const result = await storiesRemoteSource.getMapFeatureCollectionFromApi();

    expect(getSpy).toHaveBeenNthCalledWith(1, '/stories/map/', {
      headers: {
        Accept: 'application/geo+json, application/json',
      },
    });
    expect(getSpy).toHaveBeenNthCalledWith(2, '/stories/feed/?page_size=100&sort_by=recent&page=1');
    expect(result).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 7,
          geometry: {
            type: 'Point',
            coordinates: [28.9784, 41.0082],
          },
          properties: {
            title: 'Bosphorus Memory',
            location_name: 'Istanbul',
            time_type: 'decade',
            year: 1980,
            preview_text: 'A waterfront story.',
          },
        },
      ],
    });
  });

  it('normalizes the legacy map response shape without an extra enrichment request', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValue({
      results: [
        {
          id: 7,
          title: 'Bosphorus Memory',
          preview_text: 'A waterfront story.',
          location_name: 'Istanbul',
          location_lat: '41.0082',
          location_lng: '28.9784',
          time_type: 'decade',
          year: 1980,
        },
      ],
    });

    const result = await storiesRemoteSource.getMapFeatureCollectionFromApi();

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 7,
          geometry: {
            type: 'Point',
            coordinates: [28.9784, 41.0082],
          },
          properties: {
            title: 'Bosphorus Memory',
            location_name: 'Istanbul',
            time_type: 'decade',
            year: 1980,
            year_start: undefined,
            year_end: undefined,
            preview_text: 'A waterfront story.',
          },
        },
      ],
    });
  });

  it('passes geocoded location bounds to the map endpoint', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    });

    await storiesRemoteSource.getMapFeatureCollectionFromApi({
      location: 'Istanbul',
      locationBounds: {
        latMin: 40.8027,
        latMax: 41.3208,
        lngMin: 28.0065,
        lngMax: 29.4564,
      },
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/stories/map/?lat_min=40.8027&lat_max=41.3208&lng_min=28.0065&lng_max=29.4564',
      {
        headers: {
          Accept: 'application/geo+json, application/json',
        },
      },
    );
  });

  it('passes proximity params to the map endpoint', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    });

    await storiesRemoteSource.getMapFeatureCollectionFromApi({
      latitude: 41.0082,
      longitude: 28.9784,
      radiusKm: 10,
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/stories/map/?latitude=41.0082&longitude=28.9784&radius_km=10',
      {
        headers: {
          Accept: 'application/geo+json, application/json',
        },
      },
    );
  });

  it('passes the first selected tag to the map endpoint using the backend tag parameter', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    });

    await storiesRemoteSource.getMapFeatureCollectionFromApi({
      tags: ['folklore', 'ottoman-era'],
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/stories/map/?tag=folklore',
      {
        headers: {
          Accept: 'application/geo+json, application/json',
        },
      },
    );
  });

  it('keeps text search results only when the query matches title or place', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      next: null,
      results: [
        {
          id: 1,
          title: 'Harbor Memory',
          location_name: 'Istanbul',
          preview_text: 'A waterfront story.',
        },
        {
          id: 2,
          title: 'Waterfront Story',
          location_name: 'Harbor Quarter',
          preview_text: 'A local memory.',
        },
        {
          id: 3,
          title: 'Market Story',
          location_name: 'Istanbul',
          preview_text: 'The harbor appears only in this preview.',
        },
        {
          id: 4,
          title: 'Festival Story',
          location_name: 'Istanbul',
          narrative: 'The harbor appears only in this narrative.',
        },
        {
          id: 5,
          title: 'Tagged Story',
          location_name: 'Istanbul',
          tags: [{ name: 'harbor' }],
        },
      ],
    });

    const result = await storiesRemoteSource.getStoriesFromApi({ q: 'harbor' });

    expect(result).toEqual([
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 2 }),
    ]);
  });

  it('filters map features by geocoded bounds when the backend ignores bbox params', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 1,
          geometry: {
            type: 'Point',
            coordinates: [28.9784, 41.0082],
          },
          properties: {
            title: 'Istanbul Story',
            location_name: 'Istanbul',
            preview_text: 'Inside Istanbul.',
          },
        },
        {
          type: 'Feature',
          id: 2,
          geometry: {
            type: 'Point',
            coordinates: [32.8597, 39.9334],
          },
          properties: {
            title: 'Ankara Story',
            location_name: 'Ankara',
            preview_text: 'Inside Ankara.',
          },
        },
      ],
    });

    const result = await storiesRemoteSource.getMapFeatureCollectionFromApi({
      location: 'Ankara',
      locationBounds: {
        latMin: 39.7,
        latMax: 40.1,
        lngMin: 32.5,
        lngMax: 33.2,
      },
    });

    expect(result.features).toHaveLength(1);
    expect(result.features[0]).toMatchObject({ id: 2 });
  });

  it('filters map features by radius when the backend ignores proximity params', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 1,
          geometry: {
            type: 'Point',
            coordinates: [28.9784, 41.0082],
          },
          properties: {
            title: 'Nearby Story',
            location_name: 'Istanbul',
            preview_text: 'Nearby.',
          },
        },
        {
          type: 'Feature',
          id: 2,
          geometry: {
            type: 'Point',
            coordinates: [32.8597, 39.9334],
          },
          properties: {
            title: 'Far Story',
            location_name: 'Ankara',
            preview_text: 'Far away.',
          },
        },
      ],
    });

    const result = await storiesRemoteSource.getMapFeatureCollectionFromApi({
      latitude: 41.0082,
      longitude: 28.9784,
      radiusKm: 1,
    });

    expect(result.features).toHaveLength(1);
    expect(result.features[0]).toMatchObject({ id: 1 });
  });
});
