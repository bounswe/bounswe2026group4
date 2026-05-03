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

  it('resolves convenience period requests', () => {
    expect(resolveTimelinePeriodYears({ year: 1923 })).toEqual({ yearFrom: 1923, yearTo: 1923 });
    expect(resolveTimelinePeriodYears({ yearRange: { from: 1918, to: 1914 } })).toEqual({ yearFrom: 1914, yearTo: 1918 });
    expect(resolveTimelinePeriodYears({ decade: 1928 })).toEqual({ yearFrom: 1920, yearTo: 1929 });
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
});
