import { resetApiTransport, setApiTransport } from '../../../../../core/api/client';
import { interceptors } from '../../../../../core/api/interceptors';
import { userService } from '../index';

describe('userService', () => {
  beforeEach(() => {
    interceptors.clear();
    resetApiTransport();
  });

  afterEach(() => {
    resetApiTransport();
  });

  it('fetches the authenticated profile from /users/me/', async () => {
    setApiTransport(async (method: any, config: any) => {
      if (method === 'GET' && config.url === '/users/me/') {
        return {
          status: 200,
          data: {
            success: true,
            data: {
              id: 7,
              username: 'Traveler',
              email: 'traveler@example.com',
              total_points: 5,
              date_joined: '2026-01-15T10:00:00Z',
              profile: {
                bio: 'Collecting neighborhood memories.',
                location: 'Istanbul',
              },
            },
          } as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/users/7/') {
        return {
          status: 200,
          data: {
            id: 7,
            username: 'Traveler',
            total_points: 5,
            published_story_count: 3,
            birth_year: 1995,
            location: 'Istanbul',
            bio: 'Collecting neighborhood memories.',
          } as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    await expect(userService.getCurrentProfile()).resolves.toMatchObject({
      id: '7',
      username: 'Traveler',
      email: 'traveler@example.com',
      location: 'Istanbul',
      publishedStoryCount: 3,
      birthYear: 1995,
    });
  });

  it('fetches a public profile from /users/:id', async () => {
    setApiTransport(async (method: any, config: any) => {
      if (method === 'GET' && config.url === '/users/12/') {
        return {
          status: 200,
          data: {
            id: 12,
            username: 'Aylin',
            total_points: 9,
            published_story_count: 4,
            followers_count: 12,
            following_count: 5,
            is_followed_by_me: true,
            location: 'Izmir',
            bio: 'Historian',
            birth_year: 1988,
          } as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    await expect(userService.getPublicProfile('12')).resolves.toMatchObject({
      id: '12',
      username: 'Aylin',
      publishedStoryCount: 4,
      birthYear: 1988,
      followersCount: 12,
      followingCount: 5,
      isFollowedByMe: true,
    });
  });

  it('preserves an unknown follow state when the public profile omits it', async () => {
    setApiTransport(async (method: any, config: any) => {
      if (method === 'GET' && config.url === '/users/12/') {
        return {
          status: 200,
          data: {
            id: 12,
            username: 'Aylin',
            total_points: 9,
            published_story_count: 4,
            followers_count: 12,
            following_count: 5,
          } as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    const profile = await userService.getPublicProfile('12');

    expect(profile.followersCount).toBe(12);
    expect(profile.followingCount).toBe(5);
    expect(profile.isFollowedByMe).toBeUndefined();
  });

  it('follows and unfollows users with the expected endpoints', async () => {
    const requests: string[] = [];

    setApiTransport(async (method: any, config: any) => {
      requests.push(`${method} ${config.url}`);

      return {
        status: method === 'DELETE' ? 204 : 201,
        data: method === 'DELETE' ? null : { success: true, data: {} },
        config,
      } as never;
    });

    await userService.followUser('12');
    await userService.unfollowUser('12');

    expect(requests).toEqual([
      'POST /users/12/follow/',
      'DELETE /users/12/follow/',
    ]);
  });

  it('loads followers and following lists with pagination', async () => {
    setApiTransport(async (method: any, config: any) => {
      if (method === 'GET' && config.url === '/users/12/followers/?page=2&page_size=20') {
        return {
          status: 200,
          data: {
            count: 2,
            next: null,
            previous: 'previous-page',
            results: [
              { id: 7, username: 'Traveler', profile_photo: 'https://cdn.example.com/user.jpg' },
              { id: 8, username: null, profile_photo: null },
            ],
          } as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/users/12/following/?page=1&page_size=20') {
        return {
          status: 200,
          data: {
            count: 1,
            next: 'next-page',
            previous: null,
            results: [{ id: 9, username: 'Aylin', profile_photo: null }],
          } as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    await expect(userService.getFollowers('12', 2)).resolves.toMatchObject({
      count: 2,
      previous: 'previous-page',
      users: [
        { id: '7', username: 'Traveler', profilePhoto: 'https://cdn.example.com/user.jpg' },
        { id: '8', username: null, profilePhoto: null },
      ],
    });
    await expect(userService.getFollowing('12')).resolves.toMatchObject({
      count: 1,
      next: 'next-page',
      users: [{ id: '9', username: 'Aylin' }],
    });
  });

  it('loads saved stories from the profile bookmarks endpoint', async () => {
    setApiTransport(async (method: any, config: any) => {
      if (method === 'GET' && config.url === '/users/7/bookmarks/?page=2&page_size=10') {
        return {
          status: 200,
          data: {
            count: 1,
            next: null,
            previous: 'previous-page',
            results: [
              {
                id: 'story-1',
                title: 'Saved Harbor',
                location_name: 'Golden Horn',
                time_type: 'exact_year',
                year: 1978,
                preview_text: 'A saved story.',
                submitted_at: '2026-03-18T10:00:00Z',
                like_count: 4,
                user_has_saved: true,
              },
            ],
          } as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    await expect(userService.getSavedStories('7', 2)).resolves.toMatchObject({
      page: 2,
      totalCount: 1,
      items: [
        {
          id: 'story-1',
          title: 'Saved Harbor',
          locationName: 'Golden Horn',
          timePeriod: '1978',
          likeCount: 4,
          savedByViewer: true,
        },
      ],
    });
  });

  it('updates the authenticated profile via PATCH /users/me/', async () => {
    setApiTransport(async (method: any, config: any) => {
      if (method === 'PATCH' && config.url === '/users/me/') {
        expect(config.data).toMatchObject({
          username: 'Traveler Updated',
          is_username_public: false,
          profile: {
            bio: 'Updated bio',
            location: 'Ankara',
            birth_date: '1994-01-01',
            is_location_public: true,
            is_birth_date_public: false,
            is_photo_public: true,
          },
        });

        return {
          status: 200,
          data: {
            success: true,
            data: {
              id: 7,
              username: 'Traveler Updated',
              email: 'traveler@example.com',
              total_points: 5,
              is_username_public: false,
              is_email_verified: true,
              profile: {
                bio: 'Updated bio',
                location: 'Ankara',
                birth_date: '1994-01-01',
                is_location_public: true,
                is_birth_date_public: false,
                is_photo_public: true,
              },
            },
          } as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/users/7/') {
        return {
          status: 200,
          data: {
            id: 7,
            username: 'Traveler Updated',
            total_points: 5,
            published_story_count: 4,
            location: 'Ankara',
            bio: 'Updated bio',
          } as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    await expect(
      userService.updateCurrentProfile({
        username: 'Traveler Updated',
        bio: 'Updated bio',
        location: 'Ankara',
        birthDate: '1994-01-01',
        isUsernamePublic: false,
        isLocationPublic: true,
        isBirthDatePublic: false,
        isPhotoPublic: true,
      }),
    ).resolves.toMatchObject({
      username: 'Traveler Updated',
      location: 'Ankara',
      isUsernamePublic: false,
      publishedStoryCount: 4,
    });
  });

  it('supports profile completion updates without sending username fields', async () => {
    setApiTransport(async (method: any, config: any) => {
      if (method === 'PATCH' && config.url === '/users/me/') {
        expect(config.data).toMatchObject({
          profile: {
            first_name: 'Ada',
            last_name: 'Lovelace',
            location: '',
            birth_date: null,
            bio: '',
            is_name_public: true,
            is_location_public: true,
            is_birth_date_public: false,
            is_photo_public: true,
          },
        });
        expect(config.data.username).toBeUndefined();
        expect(config.data.is_username_public).toBeUndefined();

        return {
          status: 200,
          data: {
            success: true,
            data: {
              id: 7,
              username: 'Traveler',
              email: 'traveler@example.com',
              total_points: 5,
              is_username_public: true,
              is_email_verified: true,
              profile: {
                first_name: 'Ada',
                last_name: 'Lovelace',
                bio: '',
                location: '',
                birth_date: null,
                is_name_public: true,
                is_location_public: true,
                is_birth_date_public: false,
                is_photo_public: true,
              },
            },
          } as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/users/7/') {
        return {
          status: 200,
          data: {
            id: 7,
            username: 'Traveler',
            total_points: 5,
            published_story_count: 4,
            first_name: 'Ada',
            last_name: 'Lovelace',
          } as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    await expect(
      userService.updateCurrentProfile({
        firstName: 'Ada',
        lastName: 'Lovelace',
        bio: '',
        location: '',
        birthDate: null,
        isNamePublic: true,
        isLocationPublic: true,
        isBirthDatePublic: false,
        isPhotoPublic: true,
      }),
    ).resolves.toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      isNamePublic: true,
    });
  });

  it('uploads a profile photo via POST /users/me/photo/', async () => {
    setApiTransport(async (method: any, config: any) => {
      if (method === 'POST' && config.url === '/users/me/photo/') {
        expect(config.data).toBeInstanceOf(FormData);

        return {
          status: 200,
          data: {
            success: true,
            photo_url: 'https://cdn.example.com/profile.jpg',
          } as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/users/me/') {
        return {
          status: 200,
          data: {
            success: true,
            data: {
              id: 7,
              username: 'Traveler',
              email: 'traveler@example.com',
              total_points: 5,
              is_username_public: true,
              is_email_verified: true,
              profile: {
                bio: 'Collecting neighborhood memories.',
                location: 'Istanbul',
                profile_photo: 'https://cdn.example.com/profile.jpg',
                is_location_public: true,
                is_birth_date_public: false,
                is_photo_public: true,
              },
            },
          } as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/users/7/') {
        return {
          status: 200,
          data: {
            id: 7,
            username: 'Traveler',
            total_points: 5,
            published_story_count: 3,
          } as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    await expect(
      userService.uploadProfilePhoto({
        uri: 'file:///profile.jpg',
        fileName: 'profile.jpg',
        mimeType: 'image/jpeg',
      }),
    ).resolves.toMatchObject({
      profilePhoto: 'https://cdn.example.com/profile.jpg',
    });
  });

  it('removes a profile photo via DELETE /users/me/photo/', async () => {
    setApiTransport(async (method: any, config: any) => {
      if (method === 'DELETE' && config.url === '/users/me/photo/') {
        return {
          status: 204,
          data: null as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/users/me/') {
        return {
          status: 200,
          data: {
            success: true,
            data: {
              id: 7,
              username: 'Traveler',
              email: 'traveler@example.com',
              total_points: 5,
              is_username_public: true,
              is_email_verified: true,
              profile: {
                bio: 'Collecting neighborhood memories.',
                location: 'Istanbul',
                profile_photo: null,
                is_location_public: true,
                is_birth_date_public: false,
                is_photo_public: false,
              },
            },
          } as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/users/7/') {
        return {
          status: 200,
          data: {
            id: 7,
            username: 'Traveler',
            total_points: 5,
            published_story_count: 3,
          } as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    await expect(userService.removeProfilePhoto()).resolves.toMatchObject({
      profilePhoto: null,
      isPhotoPublic: false,
    });
  });

  it('deletes the authenticated account via DELETE /users/me/', async () => {
    setApiTransport(async (method: any, config: any) => {
      if (method === 'DELETE' && config.url === '/users/me/') {
        expect(config.data).toMatchObject({
          password: 'top-secret',
          hard_delete: true,
        });

        return {
          status: 204,
          data: null as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    await expect(userService.deleteAccount('top-secret', true)).resolves.toBeUndefined();
  });
});
