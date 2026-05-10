import { apiClient } from '../../../../../core/api/client';
import { geocodeLocationQuery, parseBackendBounds, searchLocationSuggestions } from '../geocodingService';

describe('geocodingService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('geocodes a place name through the backend API into backend-ready bounds', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValue({
      lat_min: 40.8027,
      lat_max: 41.3208,
      lng_min: 28.0065,
      lng_max: 29.4564,
    });

    const bounds = await geocodeLocationQuery('Istanbul');

    expect(getSpy).toHaveBeenCalledWith('/geocode/?q=Istanbul');
    expect(bounds).toEqual({
      latMin: 40.8027,
      latMax: 41.3208,
      lngMin: 28.0065,
      lngMax: 29.4564,
    });
  });

  it('returns null when the backend has no usable result so callers can fall back to text search', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue(null);

    await expect(geocodeLocationQuery('No Such Place')).resolves.toBeNull();
  });

  it('fetches location suggestions through the backend API and derives map centers from bbox', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValue([
      {
        id: '1',
        title: 'Istanbul',
        subtitle: 'Turkey',
        bbox: {
          lat_min: 40.8,
          lat_max: 41.2,
          lng_min: 28.6,
          lng_max: 29.4,
        },
      },
      {
        id: 'missing-bbox',
        title: 'Nowhere',
        bbox: null,
      },
    ]);

    await expect(searchLocationSuggestions('Istanbul')).resolves.toEqual([
      {
        id: '1',
        title: 'Istanbul',
        subtitle: 'Turkey',
        latitude: 41,
        longitude: 29,
        bounds: {
          latMin: 40.8,
          latMax: 41.2,
          lngMin: 28.6,
          lngMax: 29.4,
        },
      },
    ]);
    expect(getSpy).toHaveBeenCalledWith('/geocode/suggestions/?q=Istanbul');
  });

  it('does not call the backend for short suggestion queries', async () => {
    const getSpy = jest.spyOn(apiClient, 'get');

    await expect(searchLocationSuggestions('Is')).resolves.toEqual([]);

    expect(getSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid backend bounding boxes', () => {
    expect(parseBackendBounds({ lat_min: 'not-a-number', lat_max: '41', lng_min: '28', lng_max: '29' })).toBeNull();
    expect(parseBackendBounds(undefined)).toBeNull();
  });
});
