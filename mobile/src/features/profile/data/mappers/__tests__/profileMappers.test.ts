import { mapCurrentProfile, mapPublicProfile, mergePublicProfileSummary } from '..';

describe('profile mappers', () => {
  it('maps older public profile payloads', () => {
    expect(
      mapPublicProfile({
        id: 12,
        username: 'Aylin',
        total_points: 9,
        published_story_count: 4,
        location: 'Izmir',
        bio: 'Historian',
        birth_year: 1988,
      }),
    ).toMatchObject({
      id: '12',
      username: 'Aylin',
      totalPoints: 9,
      publishedStoryCount: 4,
      location: 'Izmir',
      bio: 'Historian',
      birthYear: 1988,
    });
  });

  it('maps normalized public profile payloads without breaking privacy fields', () => {
    expect(
      mapPublicProfile({
        id: '12',
        username: null,
        totalPoints: '11',
        isUsernamePublic: false,
        stats: {
          publishedStoryCount: 5,
        },
        profile: {
          firstName: 'Aylin',
          profilePhotoUrl: 'https://example.com/profile.jpg',
        },
      }),
    ).toMatchObject({
      id: '12',
      username: null,
      totalPoints: 11,
      publishedStoryCount: 5,
      firstName: 'Aylin',
      profilePhoto: 'https://example.com/profile.jpg',
      isUsernamePublic: false,
    });
  });

  it('maps normalized current profile payloads', () => {
    expect(
      mapCurrentProfile({
        id: 7,
        username: 'Traveler',
        email: 'traveler@example.com',
        totalPoints: 5,
        followers_count: 8,
        following_count: '13',
        isUsernamePublic: true,
        profile: {
          firstName: 'Ada',
          birthDate: '1994-01-01',
          profilePhotoUrl: 'https://example.com/me.jpg',
          isPhotoPublic: true,
        },
      }),
    ).toMatchObject({
      id: '7',
      username: 'Traveler',
      email: 'traveler@example.com',
      totalPoints: 5,
      firstName: 'Ada',
      birthDate: '1994-01-01',
      profilePhoto: 'https://example.com/me.jpg',
      followersCount: 8,
      followingCount: 13,
      isUsernamePublic: true,
      isPhotoPublic: true,
    });
  });

  it('merges normalized public summary fields into the current profile', () => {
    expect(
      mergePublicProfileSummary(
        {
          id: '7',
          username: 'Traveler',
          totalPoints: 5,
        },
        {
          stats: {
            publishedStoryCount: 6,
          },
          followers_count: 11,
          following_count: 9,
          birthYear: 1994,
        },
      ),
    ).toMatchObject({
      publishedStoryCount: 6,
      followersCount: 11,
      followingCount: 9,
      birthYear: 1994,
    });
  });

  it('keeps existing summary counts when public summary omits them', () => {
    expect(
      mergePublicProfileSummary(
        {
          id: '7',
          username: 'Traveler',
          totalPoints: 5,
          publishedStoryCount: 4,
          followersCount: 8,
          followingCount: 13,
        },
        {
          stats: {},
          birthYear: 1994,
        },
      ),
    ).toMatchObject({
      publishedStoryCount: 4,
      followersCount: 8,
      followingCount: 13,
      birthYear: 1994,
    });
  });
});
