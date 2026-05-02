import { mapFeedItem, mapFeedPage } from '..';

describe('feed mappers', () => {
  it('maps backend feed card interaction metadata', () => {
    expect(
      mapFeedItem({
        id: 42,
        title: 'The City Walls',
        location_name: 'Old City',
        time_type: 'exact_year',
        year: 1453,
        preview_text: 'A story about the old city walls.',
        submitted_at: '2026-03-18T10:00:00Z',
        like_count: 7,
        user_has_saved: true,
      }),
    ).toEqual({
      id: '42',
      title: 'The City Walls',
      locationName: 'Old City',
      timePeriod: '1453',
      previewText: 'A story about the old city walls.',
      submittedAt: '2026-03-18T10:00:00Z',
      hasMedia: false,
      likeCount: 7,
      savedByViewer: true,
      tags: [],
    });
  });

  it('maps paginated feed responses', () => {
    const page = mapFeedPage(
      {
        count: 1,
        next: null,
        results: [
          {
            id: 'story-1',
            title: 'Story 1',
            like_count: 3,
          },
        ],
      },
      1,
      10,
    );

    expect(page.totalCount).toBe(1);
    expect(page.hasNextPage).toBe(false);
    expect(page.items[0].likeCount).toBe(3);
  });

  it('maps exact date feed card time periods without changing year-based formatting', () => {
    expect(
      mapFeedItem({
        id: 44,
        title: 'Republic Day',
        location_name: 'Ankara',
        time_type: 'exact_date',
        date_value: '1923-10-29',
        time_value: '09:30:00',
      }).timePeriod,
    ).toBe('1923-10-29 09:30');
  });

  it('maps legacy like count aliases from feed payloads', () => {
    expect(
      mapFeedItem({
        id: 'story-2',
        title: 'Legacy Story',
        likes_count: '4',
      }).likeCount,
    ).toBe(4);

    expect(
      mapFeedItem({
        id: 'story-3',
        title: 'Total Likes Story',
        total_likes: 8,
      }).likeCount,
    ).toBe(8);
  });
});
