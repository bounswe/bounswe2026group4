import { resetApiTransport, setApiTransport } from '../../../../../core/api/client';
import { resolveTimelinePeriodYears, timelineRemoteSource } from '..';

describe('timelineRemoteSource', () => {
  afterEach(() => {
    resetApiTransport();
  });

  it('calls the timeline endpoint with period, pagination, and bounding-box params', async () => {
    const requests: string[] = [];

    setApiTransport(async (_method, config) => {
      requests.push(config.url ?? '');

      return {
        status: 200,
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [{ id: 1, title: 'Republic', time_type: 'exact_year', year: 1923 }],
        } as never,
        config,
      };
    });

    await timelineRemoteSource.getTimeline({
      page: 2,
      pageSize: 5,
      year: 1923,
      filters: {
        locationBounds: {
          latMin: 40.9,
          latMax: 41.2,
          lngMin: 28.7,
          lngMax: 29.2,
        },
      },
    });

    expect(requests[0]).toBe(
      '/stories/timeline/?page=2&page_size=5&year_from=1923&year_to=1923&lat_min=40.9&lat_max=41.2&lng_min=28.7&lng_max=29.2',
    );
  });

  it('uses the timeline endpoint with the image availability param', async () => {
    const requests: string[] = [];

    setApiTransport(async (_method, config) => {
      requests.push(config.url ?? '');

      return {
        status: 200,
        data: {
          count: 0,
          next: null,
          previous: null,
          results: [],
        } as never,
        config,
      };
    });

    await timelineRemoteSource.getTimeline({
      filters: { hasMedia: true },
    });

    expect(requests[0]).toBe('/stories/timeline/?page=1&page_size=10&has_image=true');
  });

  it('resolves convenience period requests', () => {
    expect(resolveTimelinePeriodYears({ year: 1923 })).toEqual({ yearFrom: 1923, yearTo: 1923 });
    expect(resolveTimelinePeriodYears({ yearRange: { from: 1918, to: 1914 } })).toEqual({ yearFrom: 1914, yearTo: 1918 });
    expect(resolveTimelinePeriodYears({ decade: 1928 })).toEqual({ yearFrom: 1920, yearTo: 1929 });
    expect(resolveTimelinePeriodYears({ decade: -7495 })).toEqual({ yearFrom: -7499, yearTo: -7490 });
    expect(resolveTimelinePeriodYears({ decade: -7500 })).toEqual({ yearFrom: -7509, yearTo: -7500 });
    expect(resolveTimelinePeriodYears({ approximatePeriod: { century: 1900, position: 'early' } })).toEqual({ yearFrom: 1900, yearTo: 1933 });
    expect(resolveTimelinePeriodYears({ approximatePeriod: { century: 1900, position: 'mid' } })).toEqual({ yearFrom: 1934, yearTo: 1966 });
    expect(resolveTimelinePeriodYears({ approximatePeriod: { century: 1900, position: 'late' } })).toEqual({ yearFrom: 1967, yearTo: 1999 });
  });

  it('falls back to search for query filters and returns client-side chronological pages', async () => {
    const requests: string[] = [];

    setApiTransport(async (_method, config) => {
      requests.push(config.url ?? '');

      return {
        status: 200,
        data: {
          count: 2,
          next: null,
          previous: null,
          results: [
            { id: 2, title: 'Harbor New', location_name: 'Harbor', time_type: 'exact_year', year: 1950 },
            { id: 1, title: 'Harbor Old', location_name: 'Harbor', time_type: 'exact_year', year: 1900 },
          ],
        } as never,
        config,
      };
    });

    const response = await timelineRemoteSource.getTimeline({
      page: 1,
      pageSize: 1,
      filters: { q: 'harbor' },
      yearRange: { from: 1900, to: 2000 },
    });

    expect(requests[0]).toBe('/stories/search/?page_size=100&year_from=1900&year_to=2000&q=harbor&page=1');
    expect(response.count).toBe(2);
    expect(response.next).toBe('client-next-page');
    expect(response.results?.[0]).toMatchObject({ title: 'Harbor Old' });
  });

  it('filters fallback results by the visible historical year badge', async () => {
    setApiTransport(async (_method, config) => ({
      status: 200,
      data: {
        count: 3,
        next: null,
        previous: null,
        results: [
          { id: 1, title: 'Visible midpoint', time_type: 'year_range', year_start: 1840, year_end: 1870 },
          { id: 2, title: 'Exact same raw year', time_type: 'exact_year', year: 1840 },
          { id: 3, title: 'Exact later year', time_type: 'exact_year', year: 1860 },
        ],
      } as never,
      config,
    }));

    const response = await timelineRemoteSource.getTimeline({
      page: 1,
      pageSize: 10,
      filters: { q: 'e' },
      yearRange: { from: 1855, to: 1855 },
    });

    expect(response).toMatchObject({
      count: 1,
      results: [{ id: 1, title: 'Visible midpoint' }],
    });
  });

  it('falls back to feed for tag filters and sends the first selected tag parameter', async () => {
    const requests: string[] = [];

    setApiTransport(async (_method, config) => {
      requests.push(config.url ?? '');

      return {
        status: 200,
        data: {
          count: 2,
          next: null,
          previous: null,
          results: [
            {
              id: 2,
              title: 'Architecture New',
              time_type: 'exact_year',
              year: 1950,
              tags: [{ name: 'architecture' }],
            },
            {
              id: 1,
              title: 'Architecture Old',
              time_type: 'exact_year',
              year: 1900,
              tags: [{ name: 'architecture' }, { name: 'ottoman-era' }],
            },
          ],
        } as never,
        config,
      };
    });

    const response = await timelineRemoteSource.getTimeline({
      page: 1,
      pageSize: 10,
      filters: { tags: ['architecture'] },
    });

    expect(requests[0]).toBe('/stories/feed/?page_size=100&sort_by=recent&tag=architecture&page=1');
    expect(response.count).toBe(2);
    expect(response.results?.map((story) => (story as { id: number }).id)).toEqual([1, 2]);
  });

  it('refines additional selected tags when fallback results include tag metadata', async () => {
    setApiTransport(async (_method, config) => ({
      status: 200,
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          {
            id: 1,
            title: 'Full match',
            time_type: 'exact_year',
            year: 1900,
            tags: [{ name: 'architecture' }, { name: 'ottoman-era' }],
          },
          {
            id: 2,
            title: 'Partial match',
            time_type: 'exact_year',
            year: 1910,
            tags: [{ name: 'architecture' }],
          },
        ],
      } as never,
      config,
    }));

    const response = await timelineRemoteSource.getTimeline({
      filters: { tags: ['architecture', 'ottoman-era'] },
    });

    expect(response).toMatchObject({
      count: 1,
      results: [{ id: 1, title: 'Full match' }],
    });
  });

  it('does not drop tag-filtered timeline results when fallback results omit tag fields', async () => {
    setApiTransport(async (_method, config) => ({
      status: 200,
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 1, title: 'Tagged story', time_type: 'exact_year', year: 1900 }],
      } as never,
      config,
    }));

    const response = await timelineRemoteSource.getTimeline({
      filters: { tags: ['architecture', 'ottoman-era'] },
    });

    expect(response).toMatchObject({
      count: 1,
      results: [{ id: 1, title: 'Tagged story' }],
    });
  });

  it('combines search, period, and tag filters in timeline fallback requests', async () => {
    const requests: string[] = [];

    setApiTransport(async (_method, config) => {
      requests.push(config.url ?? '');

      return {
        status: 200,
        data: {
          count: 0,
          next: null,
          previous: null,
          results: [],
        } as never,
        config,
      };
    });

    await timelineRemoteSource.getTimeline({
      filters: { q: 'harbor', tags: ['architecture'] },
      yearRange: { from: 1900, to: 1950 },
    });

    expect(requests[0]).toBe(
      '/stories/search/?page_size=100&year_from=1900&year_to=1950&tag=architecture&q=harbor&page=1',
    );
  });

  it('falls back with proximity params and keeps nearby stories chronological', async () => {
    const requests: string[] = [];

    setApiTransport(async (_method, config) => {
      requests.push(config.url ?? '');

      return {
        status: 200,
        data: {
          count: 3,
          next: null,
          previous: null,
          results: [
            {
              id: 2,
              title: 'Nearby New',
              time_type: 'exact_year',
              year: 1950,
              location_lat: 41.0202,
              location_lng: 28.9602,
            },
            {
              id: 3,
              title: 'Too Far',
              time_type: 'exact_year',
              year: 1900,
              location_lat: 41.08,
              location_lng: 28.96,
            },
            {
              id: 1,
              title: 'Nearby Old',
              time_type: 'exact_year',
              year: 1900,
              location_lat: 41.02,
              location_lng: 28.96,
            },
          ],
        } as never,
        config,
      };
    });

    const response = await timelineRemoteSource.getTimeline({
      filters: {
        latitude: 41.02,
        longitude: 28.96,
        radiusKm: 0.5,
      },
    });

    expect(requests[0]).toBe(
      '/stories/feed/?page_size=100&sort_by=recent&latitude=41.02&longitude=28.96&radius_km=0.5&page=1',
    );
    expect(response.count).toBe(2);
    expect(response.results?.map((story) => (story as { title: string }).title)).toEqual([
      'Nearby Old',
      'Nearby New',
    ]);
  });

  it('refines fallback results by image URL availability', async () => {
    const requests: string[] = [];

    setApiTransport(async (_method, config) => {
      requests.push(config.url ?? '');

      return {
        status: 200,
        data: {
          count: 3,
          next: null,
          previous: null,
          results: [
            {
              id: 1,
              title: 'Text only',
              time_type: 'exact_year',
              year: 1900,
              photo_url: null,
            },
            {
              id: 2,
              title: 'With photo url harbor',
              time_type: 'exact_year',
              year: 1910,
              photo_url: 'https://example.com/story.jpg',
            },
            {
              id: 3,
              title: 'With media item harbor',
              time_type: 'exact_year',
              year: 1920,
              media_items: [{ media_type: 'image', url: 'https://example.com/media.jpg' }],
            },
          ],
        } as never,
        config,
      };
    });

    const response = await timelineRemoteSource.getTimeline({
      filters: { q: 'harbor', hasMedia: true },
    });

    expect(requests[0]).toBe('/stories/search/?page_size=100&q=harbor&page=1');
    expect(response.count).toBe(2);
    expect(response.results?.map((story) => (story as { title: string }).title)).toEqual([
      'With photo url harbor',
      'With media item harbor',
    ]);
  });

  it('checks story details when fallback rows omit image URL metadata', async () => {
    const requests: string[] = [];

    setApiTransport(async (_method, config) => {
      requests.push(config.url ?? '');

      if (config.url === '/stories/search/?page_size=100&q=timeline&page=1') {
        return {
          status: 200,
          data: {
            count: 2,
            next: null,
            previous: null,
            results: [
              { id: 1, title: 'Timeline row with hidden image', time_type: 'exact_year', year: 1900 },
              { id: 2, title: 'Timeline row without image', time_type: 'exact_year', year: 1910 },
            ],
          } as never,
          config,
        };
      }

      if (config.url === '/stories/1/') {
        return {
          status: 200,
          data: {
            id: 1,
            title: 'Timeline row with hidden image',
            media_items: [{ media_type: 'image', url: 'https://example.com/detail.jpg' }],
          } as never,
          config,
        };
      }

      if (config.url === '/stories/2/') {
        return {
          status: 200,
          data: {
            id: 2,
            title: 'Timeline row without image',
            media_items: [],
          } as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${config.url}`);
    });

    const response = await timelineRemoteSource.getTimeline({
      filters: { q: 'timeline', hasMedia: true },
    });

    expect(requests).toEqual([
      '/stories/search/?page_size=100&q=timeline&page=1',
      '/stories/1/',
      '/stories/2/',
    ]);
    expect(response.count).toBe(1);
    expect(response.results?.[0]).toMatchObject({ id: 1 });
  });
});
