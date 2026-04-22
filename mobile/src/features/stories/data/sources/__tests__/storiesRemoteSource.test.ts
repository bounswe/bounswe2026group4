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
});
