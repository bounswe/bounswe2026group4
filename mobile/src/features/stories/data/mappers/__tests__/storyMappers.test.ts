import { mapGeoJSONStoryMapPin, mapStory, mapStoryComment } from '..';

describe('story mappers', () => {
  it('maps the backend story detail payload into the mobile story entity', () => {
    const result = mapStory({
      id: 42,
      title: 'The City Walls',
      narrative: 'First paragraph.\n\nSecond paragraph.',
      status: 'published',
      location_name: 'Old City',
      location_lat: '41.0082',
      location_lng: '28.9784',
      time_type: 'exact_year',
      year: 1453,
      contributor_name: null,
      submitted_at: '2026-03-18T10:00:00Z',
      like_count: 7,
      user_has_liked: true,
      media_items: [
        {
          id: 1,
          url: 'https://example.com/photo.jpg',
          media_type: 'image',
          order: 0,
        },
      ],
    });

    expect(result).toEqual({
      id: '42',
      title: 'The City Walls',
      narrative: ['First paragraph.', 'Second paragraph.'],
      status: 'published',
      location: {
        name: 'Old City',
        latitude: 41.0082,
        longitude: 28.9784,
      },
      timePeriod: '1453',
      contributorName: 'Deleted user',
      submittedAt: '2026-03-18T10:00:00Z',
      mediaUrl: 'https://example.com/photo.jpg',
      likeCount: 7,
      likedByViewer: true,
      comments: [],
    });
  });

  it('keeps anonymous fallback when a contributor exists but their public name is hidden', () => {
    const result = mapStory({
      id: 52,
      user: 7,
      title: 'Hidden Author Story',
      narrative: 'Only one paragraph.',
      status: 'published',
      location_name: 'Beyoglu',
      location_lat: '41.0369',
      location_lng: '28.9850',
      time_type: 'exact_year',
      year: 1923,
      contributor_name: null,
      submitted_at: '2026-03-18T10:00:00Z',
    });

    expect(result.contributorName).toBe('Anonymous');
  });

  it('maps backend comments into the mobile comment shape', () => {
    expect(
      mapStoryComment({
        id: 9,
        text: 'Great story!',
        author_username: null,
        is_anonymized: true,
        created_at: '2026-03-20T12:00:00Z',
      }),
    ).toEqual({
      id: '9',
      authorName: 'Deleted account',
      body: 'Great story!',
      createdAt: '2026-03-20T12:00:00Z',
    });
  });

  it('maps a GeoJSON feature into the mobile story map pin shape', () => {
    expect(
      mapGeoJSONStoryMapPin({
        type: 'Feature',
        id: 42,
        geometry: {
          type: 'Point',
          coordinates: [28.9784, 41.0082],
        },
        properties: {
          title: 'The City Walls',
          location_name: 'Old City',
          time_type: 'exact_year',
          year: 1453,
          preview_text: 'First paragraph.',
        },
      }),
    ).toEqual({
      id: '42',
      title: 'The City Walls',
      previewText: 'First paragraph.',
      placeName: 'Old City',
      timePeriod: '1453',
      latitude: 41.0082,
      longitude: 28.9784,
    });
  });
});
