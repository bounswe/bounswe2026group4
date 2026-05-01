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
      temporal_coverage_iso8601: '1453',
      tags: ['Walls', 'Conquest'],
      like_count: 7,
      user_has_liked: true,
      user_has_saved: true,
      media_items: [
        {
          id: 1,
          url: 'https://example.com/photo.jpg',
          alt_text: 'Stone city walls at sunset',
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
      temporalCoverageIso8601: '1453',
      contributorName: 'Deleted user',
      isContributorAnonymous: false,
      submittedAt: '2026-03-18T10:00:00Z',
      mediaUrl: 'https://example.com/photo.jpg',
      mediaAltText: 'Stone city walls at sunset',
      mediaItems: [
        {
          id: '1',
          type: 'image',
          url: 'https://example.com/photo.jpg',
          altText: 'Stone city walls at sunset',
        },
      ],
      tags: ['Walls', 'Conquest'],
      likeCount: 7,
      likedByViewer: true,
      savedByViewer: true,
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
    expect(result.isContributorAnonymous).toBe(false);
    expect(result.mediaUrl).toBeUndefined();
    expect(result.mediaItems).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it('maps image, audio, and video media items in display order', () => {
    const result = mapStory({
      id: 55,
      user: 7,
      title: 'Mixed Media Memory',
      narrative: 'A private contribution.',
      status: 'published',
      location_name: 'Kadikoy',
      location_lat: '40.9903',
      location_lng: '29.0290',
      time_type: 'exact_year',
      year: 1984,
      contributor_name: 'Aylin',
      submitted_at: '2026-03-18T10:00:00Z',
      media_items: [
        { id: 3, media_type: 'video', url: 'https://example.com/story.mp4', order: 2 },
        { id: 1, media_type: 'image', url: 'https://example.com/story.jpg', alt_text: 'Story photo', order: 0 },
        { id: 2, media_type: 'audio', url: 'https://example.com/story.mp3', order: 1 },
      ],
    });

    expect(result.mediaItems).toEqual([
      { id: '1', type: 'image', url: 'https://example.com/story.jpg', altText: 'Story photo' },
      { id: '2', type: 'audio', url: 'https://example.com/story.mp3', altText: undefined },
      { id: '3', type: 'video', url: 'https://example.com/story.mp4', altText: undefined },
    ]);
    expect(result.mediaUrl).toBe('https://example.com/story.jpg');
  });

  it('maps normalized anonymous stories with the anonymous contributor label', () => {
    const result = mapStory({
      id: 53,
      user: 7,
      title: 'Anonymous Memory',
      narrative: 'A private contribution.',
      status: 'published',
      location_name: 'Kadikoy',
      location_lat: '40.9903',
      location_lng: '29.0290',
      temporal_coverage_iso8601: '1980/1989',
      contributor_visibility: 'anonymous',
      contributor_name: 'Hidden Name',
      submitted_at: '2026-03-18T10:00:00Z',
      tags: [],
      media_items: [],
    });

    expect(result.contributorName).toBe('Anonymous');
    expect(result.isContributorAnonymous).toBe(true);
    expect(result.timePeriod).toBe('1980/1989');
    expect(result.temporalCoverageIso8601).toBe('1980/1989');
    expect(result.mediaUrl).toBeUndefined();
    expect(result.mediaItems).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it('treats contributor visibility off as anonymous profile-hidden story', () => {
    const result = mapStory({
      id: 54,
      user: 7,
      title: 'Visibility Off',
      narrative: 'A private contribution.',
      status: 'published',
      location_name: 'Kadikoy',
      location_lat: '40.9903',
      location_lng: '29.0290',
      time_type: 'exact_year',
      year: 1984,
      contributor_visible: false,
      contributor_name: null,
      submitted_at: '2026-03-18T10:00:00Z',
    });

    expect(result.contributorName).toBe('Anonymous');
    expect(result.isContributorAnonymous).toBe(true);
    expect(result.contributorUserId).toBe('7');
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
      temporalCoverageIso8601: undefined,
      tags: [],
      latitude: 41.0082,
      longitude: 28.9784,
    });
  });

  it('maps normalized tags and temporal coverage for GeoJSON features', () => {
    expect(
      mapGeoJSONStoryMapPin({
        type: 'Feature',
        id: 43,
        geometry: {
          type: 'Point',
          coordinates: [28.9784, 41.0082],
        },
        properties: {
          title: 'The Tram Line',
          location_name: 'Old City',
          temporal_coverage_iso8601: '1914/1918',
          preview_text: 'A transport memory.',
          tags: [{ name: 'Transport' }, 'Urban life'],
        },
      }),
    ).toEqual({
      id: '43',
      title: 'The Tram Line',
      previewText: 'A transport memory.',
      placeName: 'Old City',
      timePeriod: '1914/1918',
      temporalCoverageIso8601: '1914/1918',
      tags: ['Transport', 'Urban life'],
      latitude: 41.0082,
      longitude: 28.9784,
    });
  });
});
