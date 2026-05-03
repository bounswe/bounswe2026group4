import { mapTimelineItem, mapTimelinePage } from '..';

describe('timeline mappers', () => {
  it('maps exact and approximate years', () => {
    expect(
      mapTimelineItem({
        id: 1,
        title: 'Conquest Memory',
        time_type: 'exact_year',
        year: 1453,
        temporal_coverage: '1453',
      }),
    ).toMatchObject({
      id: '1',
      title: 'Conquest Memory',
      timePeriod: '1453',
      temporalCoverage: '1453',
      historicalYear: 1453,
    });

    expect(
      mapTimelineItem({
        id: 2,
        title: 'Approximate Story',
        time_type: 'approximate_year',
        year: 1870,
      }).timePeriod,
    ).toBe('c. 1870');
  });

  it('maps decade, range, and exact date periods', () => {
    expect(
      mapTimelineItem({
        id: 'decade',
        title: 'Eighties',
        time_type: 'decade',
        year: 1980,
      }),
    ).toMatchObject({
      timePeriod: '1980s',
      historicalYear: 1985,
    });

    expect(
      mapTimelineItem({
        id: 'range',
        title: 'War Years',
        time_type: 'year_range',
        year_start: 1914,
        year_end: 1918,
      }),
    ).toMatchObject({
      timePeriod: '1914-1918',
      historicalYear: 1916,
    });

    expect(
      mapTimelineItem({
        id: 'date',
        title: 'Republic Day',
        time_type: 'exact_date',
        date_value: '1923-10-29',
        time_value: '09:30:00',
      }),
    ).toMatchObject({
      timePeriod: '1923-10-29 09:30',
      historicalYear: 1923,
    });
  });

  it('maps location and photo fields from timeline and feed-like payloads', () => {
    expect(
      mapTimelineItem({
        id: 3,
        title: 'Photo Story',
        time_type: 'exact_year',
        year: '1950',
        location_name: 'Golden Horn',
        location_lat: '41.02',
        location_lng: '28.96',
        photo_url: 'https://example.com/photo.jpg',
      }),
    ).toMatchObject({
      locationName: 'Golden Horn',
      latitude: 41.02,
      longitude: 28.96,
      photoUrl: 'https://example.com/photo.jpg',
    });

    expect(
      mapTimelineItem({
        id: 4,
        title: 'Media Story',
        time_type: 'exact_year',
        year: 1960,
        media_items: [
          { media_type: 'audio', url: 'https://example.com/audio.mp3', order: 0 },
          { media_type: 'image', url: 'https://example.com/image.jpg', order: 1 },
        ],
      }).photoUrl,
    ).toBe('https://example.com/image.jpg');
  });

  it('keeps photoUrl undefined when no image exists and rejects invalid records', () => {
    expect(
      mapTimelineItem({
        id: 5,
        title: 'No Image',
        time_type: 'exact_year',
        year: 1970,
      }).photoUrl,
    ).toBeUndefined();

    expect(() => mapTimelineItem({ id: 6 })).toThrow('Invalid timeline item payload.');
  });

  it('maps paginated timeline responses', () => {
    const page = mapTimelinePage(
      {
        count: 1,
        next: null,
        results: [{ id: 7, title: 'Story', time_type: 'exact_year', year: 1900 }],
      },
      1,
      10,
    );

    expect(page.totalCount).toBe(1);
    expect(page.hasNextPage).toBe(false);
    expect(page.items[0].title).toBe('Story');
  });
});
