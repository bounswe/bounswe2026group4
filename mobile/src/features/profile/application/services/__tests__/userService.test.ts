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

  it('deletes the authenticated account via DELETE /users/me/', async () => {
    setApiTransport(async (method: any, config: any) => {
      if (method === 'DELETE' && config.url === '/users/me/') {
        expect(config.data).toMatchObject({
          password: 'Password1',
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

    await expect(userService.deleteAccount('Password1', true)).resolves.toBeUndefined();
  });
});
