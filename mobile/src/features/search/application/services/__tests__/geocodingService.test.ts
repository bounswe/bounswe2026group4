import { geocodeLocationQuery, parseNominatimBounds } from '../geocodingService';

describe('geocodingService', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('geocodes a place name into backend-ready bounds', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          boundingbox: ['40.8027', '41.3208', '28.0065', '29.4564'],
        },
      ]),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const bounds = await geocodeLocationQuery('Istanbul');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://nominatim.openstreetmap.org/search?q=Istanbul&format=jsonv2&limit=1&addressdetails=1',
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en',
          'User-Agent': 'local-history-story-map-mobile/0.1.0',
        },
      },
    );
    expect(bounds).toEqual({
      latMin: 40.8027,
      latMax: 41.3208,
      lngMin: 28.0065,
      lngMax: 29.4564,
    });
  });

  it('returns null when Nominatim has no usable result so callers can fall back to text search', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([]),
    }) as typeof fetch;

    await expect(geocodeLocationQuery('No Such Place')).resolves.toBeNull();
  });

  it('rejects invalid bounding boxes', () => {
    expect(parseNominatimBounds(['not-a-number', '41', '28', '29'])).toBeNull();
    expect(parseNominatimBounds(undefined)).toBeNull();
  });
});
