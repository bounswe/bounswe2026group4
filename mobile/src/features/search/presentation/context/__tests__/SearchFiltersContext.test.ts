import { toSearchParams } from '../SearchFiltersContext';

describe('toSearchParams', () => {
  it('uses text location when geocoding did not return bounds', () => {
    expect(
      toSearchParams({
        query: '',
        location: 'Istanbul',
        locationBounds: undefined,
        timeFrom: '',
        timeTo: '',
        tags: [],
      }),
    ).toEqual({
      q: undefined,
      location: 'Istanbul',
      locationBounds: undefined,
      yearFrom: undefined,
      yearTo: undefined,
      hasMedia: undefined,
      tags: undefined,
    });
  });

  it('keeps geocoded bounds with the location label for API normalization', () => {
    const locationBounds = {
      latMin: 40.8027,
      latMax: 41.3208,
      lngMin: 28.0065,
      lngMax: 29.4564,
    };

    expect(
      toSearchParams({
        query: '',
        location: 'Istanbul',
        locationBounds,
        timeFrom: '',
        timeTo: '',
        tags: [],
      }),
    ).toEqual({
      q: undefined,
      location: 'Istanbul',
      locationBounds,
      yearFrom: undefined,
      yearTo: undefined,
      hasMedia: undefined,
      tags: undefined,
    });
  });

  it('maps the with image filter to story search params', () => {
    expect(
      toSearchParams({
        query: '',
        location: '',
        locationBounds: undefined,
        timeFrom: '',
        timeTo: '',
        hasMedia: true,
        tags: [],
      }),
    ).toEqual({
      q: undefined,
      location: undefined,
      locationBounds: undefined,
      yearFrom: undefined,
      yearTo: undefined,
      hasMedia: true,
      tags: undefined,
    });
  });
});
