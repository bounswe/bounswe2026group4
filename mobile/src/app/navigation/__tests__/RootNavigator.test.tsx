import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RootNavigator } from '../RootNavigator';
import { storage } from '../../../core/storage/storage';
import { storageKeys } from '../../../core/storage/keys';
import { interceptors } from '../../../core/api/interceptors';
import { resetApiTransport, setApiTransport } from '../../../core/api/client';
import { AppProviders } from '../../providers/AppProviders';
import { geocodeLocationQuery, searchLocationSuggestions } from '../../../features/search/application/services';

jest.mock('../../../features/search/application/services', () => ({
  geocodeLocationQuery: jest.fn(),
  searchLocationSuggestions: jest.fn(),
}));

function renderNavigator() {
  return render(
    <AppProviders>
      <RootNavigator />
    </AppProviders>,
  );
}

const feedResults = [
  {
    id: 'story-001',
    title: 'Harbor Memory',
    narrative: ['A story about the harbor.'],
    preview_text: 'A story about the harbor.',
    location_name: 'Golden Horn',
    location_lat: 41.02,
    location_lng: 28.96,
    time_type: 'exact_year',
    year: 1978,
    contributor_name: 'Aylin',
    submitted_at: '2026-03-18T10:00:00Z',
    media_items: [],
    like_count: 0,
    user_has_liked: false,
  },
];

const goldenHornBounds = { latMin: 41, latMax: 41.05, lngMin: 28.94, lngMax: 28.99 };

const storyDetail = {
  id: 'story-001',
  user: 12,
  title: 'Harbor Memory',
  narrative: ['A story about the harbor.', 'It still lives in local memory.'],
  location_name: 'Golden Horn',
  location_lat: 41.02,
  location_lng: 28.96,
  time_type: 'exact_year',
  year: 1978,
  contributor_name: 'Aylin',
  submitted_at: '2026-03-18T10:00:00Z',
  media_items: [],
  like_count: 0,
  user_has_liked: false,
  comments: [],
};

const profileDetail = {
  success: true,
  data: {
    id: 1,
    username: 'Traveler',
    email: 'traveler@example.com',
    total_points: 12,
    date_joined: '2026-01-15T10:00:00Z',
    profile: {
      bio: 'Collecting neighborhood memories.',
      location: 'Istanbul',
    },
  },
};

const publicProfileDetail = {
  id: 12,
  username: 'Aylin',
  total_points: 30,
  published_story_count: 4,
  date_joined: '2025-02-10T10:00:00Z',
  bio: 'I write about harbor neighborhoods.',
  location: 'Izmir',
  birth_year: 1988,
};

const ownPublicProfileDetail = {
  id: 1,
  username: 'Traveler',
  total_points: 12,
  published_story_count: 2,
};

const notificationResults = [
  {
    id: 501,
    notification_type: 'new_like',
    message: 'Aylin liked your story.',
    actor: { id: 12, username: 'Aylin' },
    story_id: 'story-001',
    comment_id: null,
    is_read: false,
    created_at: '2026-04-30T12:00:00Z',
  },
  {
    id: 502,
    notification_type: 'badge_earned',
    message: 'You earned a badge.',
    actor: null,
    story_id: null,
    comment_id: null,
    is_read: true,
    created_at: '2026-04-29T12:00:00Z',
  },
];

const notificationPreferences = {
  notifications_muted: false,
  preferences: {
    new_comment: true,
    new_like: true,
    moderation_action: true,
    story_removed: true,
    report_resolved: true,
    badge_earned: true,
  },
};

function installAuthTransport() {
  setApiTransport(async (method, config) => {
    if (method === 'GET' && (config.url?.startsWith('/stories/feed/') || config.url?.startsWith('/stories/search/'))) {
      return {
        status: 200,
        data: {
          count: feedResults.length,
          next: null,
          previous: null,
          results: feedResults,
        } as never,
        config,
      };
    }

    if (method === 'GET' && config.url?.startsWith('/stories/map/')) {
      return {
        status: 200,
        data: {
          count: feedResults.length,
          next: null,
          previous: null,
          results: feedResults,
        } as never,
        config,
      };
    }

    if (method === 'GET' && config.url === '/stories/story-001/') {
      return {
        status: 200,
        data: storyDetail as never,
        config,
      };
    }

    if (method === 'GET' && config.url === '/stories/story-001/comments/') {
      return {
        status: 200,
        data: { results: [] } as never,
        config,
      };
    }

    if (method === 'GET' && config.url === '/users/me/') {
      return {
        status: 200,
        data: profileDetail as never,
        config,
      };
    }

    if (method === 'GET' && config.url === '/users/12/') {
      return {
        status: 200,
        data: publicProfileDetail as never,
        config,
      };
    }

    if (method === 'GET' && config.url === '/users/1/') {
      return {
        status: 200,
        data: ownPublicProfileDetail as never,
        config,
      };
    }

    if (method === 'GET' && config.url?.startsWith('/notifications/')) {
      if (config.url === '/notifications/preferences/') {
        return {
          status: 200,
          data: notificationPreferences as never,
          config,
        };
      }

      return {
        status: 200,
        data: { notifications: notificationResults } as never,
        config,
      };
    }

    if (method === 'PATCH' && config.url?.startsWith('/notifications/')) {
      if (config.url === '/notifications/preferences/') {
        return {
          status: 200,
          data: notificationPreferences as never,
          config,
        };
      }

      return {
        status: 200,
        data: { ...notificationResults[0], is_read: true } as never,
        config,
      };
    }

    if (method === 'GET' && config.url?.startsWith('/stories/?')) {
      return {
        status: 200,
        data: {
          count: feedResults.length,
          next: null,
          previous: null,
          results: feedResults.map((story) => ({
            ...story,
            user: 1,
            narrative: 'A story about the harbor.',
          })),
        } as never,
        config,
      };
    }

    if (method === 'POST' && config.url === '/auth/login/') {
      return {
        status: 200,
        data: {
          access: 'access-token-123',
          refresh: 'refresh-token-123',
          user: {
            id: 1,
            email: 'traveler@example.com',
            username: 'Traveler',
            role: 'registered_user',
          },
        } as never,
        config,
      };
    }

    if (method === 'POST' && config.url === '/auth/register/') {
      return {
        status: 201,
        data: {
          message: 'Registration successful. Please verify your email.',
          user: {
            id: 2,
            email: 'newuser@example.com',
            username: 'NewTraveler',
            role: 'registered_user',
          },
        } as never,
        config,
      };
    }

    if (method === 'POST' && config.url === '/auth/logout/') {
      return {
        status: 204,
        data: null as never,
        config,
      };
    }

    if (method === 'PATCH' && config.url === '/users/me/') {
      const payload = config.data as {
        profile?: {
          first_name?: string;
          last_name?: string;
          bio?: string;
          location?: string;
          birth_date?: string | null;
          is_name_public?: boolean;
          is_location_public?: boolean;
          is_birth_date_public?: boolean;
          is_photo_public?: boolean;
        };
      };

      return {
        status: 200,
        data: {
          success: true,
          data: {
            id: 1,
            username: 'Traveler',
            email: 'traveler@example.com',
            role: 'user',
            total_points: 12,
            is_username_public: true,
            is_email_verified: true,
            date_joined: '2026-01-15T10:00:00Z',
            profile: {
              first_name: payload.profile?.first_name ?? '',
              last_name: payload.profile?.last_name ?? '',
              bio: payload.profile?.bio ?? '',
              location: payload.profile?.location ?? '',
              birth_date: payload.profile?.birth_date ?? null,
              is_name_public: payload.profile?.is_name_public ?? true,
              is_location_public: payload.profile?.is_location_public ?? true,
              is_birth_date_public: payload.profile?.is_birth_date_public ?? false,
              is_photo_public: payload.profile?.is_photo_public ?? true,
            },
          },
        } as never,
        config,
      };
    }

    throw new Error(`Unexpected request: ${method} ${config.url}`);
  });
}

describe('RootNavigator auth flow', () => {
  beforeEach(async () => {
    (geocodeLocationQuery as jest.Mock).mockResolvedValue(null);
    (searchLocationSuggestions as jest.Mock).mockResolvedValue([]);
    await storage.clear();
    interceptors.clear();
    resetApiTransport();
    installAuthTransport();
  });

  it('shows a message instead of redirecting unauthenticated users for protected screens', async () => {
    renderNavigator();

    await waitFor(() => {
      expect(screen.queryByText('Restoring session...')).toBeNull();
      expect(screen.getByLabelText('Submission')).toBeTruthy();
    }, { timeout: 10000 });

    fireEvent.press(screen.getByLabelText('Submission'));

    expect(await screen.findByText('Please sign in to submit a story.')).toBeTruthy();
    expect(screen.getByLabelText('Submission')).toBeTruthy();
  }, 10000);

  it('opens the main pager on the feed tab by default', async () => {
    renderNavigator();

    await waitFor(() => {
      expect(screen.getByTestId('main-route-pager').props.contentOffset.x).toBeGreaterThan(0);
    });
  });

  it('prevents parent scroll views from stealing map gestures', async () => {
    renderNavigator();

    await screen.findByLabelText('Map');
    fireEvent.press(screen.getByLabelText('Map'));

    const mapView = await screen.findByTestId('web-map-view');
    expect(mapView.props.onTouchStart).toBeUndefined();

    expect(screen.getByTestId('main-route-pager').props.scrollEnabled).toBe(false);
    expect(screen.getByTestId('main-route-pager').props.disableScrollViewPanResponder).toBe(true);
    expect(screen.getByTestId('map-route-scroll').props.scrollEnabled).toBe(false);
    expect(screen.getByTestId('map-route-scroll').props.disableScrollViewPanResponder).toBe(true);
  });

  it('shows only the StoryMap brand in the main header', async () => {
    renderNavigator();

    expect(await screen.findByText('StoryMap')).toBeTruthy();
    expect(screen.queryByText('Story map and feed')).toBeNull();
  });

  it('allows access to protected screens after login and returns to a public route on logout', async () => {
    renderNavigator();

    fireEvent.press(await screen.findByLabelText('Login'));
    expect(await screen.findByLabelText('Email address')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Email address'), 'traveler@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.press(screen.getAllByText('Sign in').at(-1)!);

    fireEvent.press(await screen.findByLabelText('Submission', {}, { timeout: 3000 }));
    await waitFor(() => {
      expect(screen.getByText('Submit a story')).toBeTruthy();
    });
    expect(screen.getByText('Share a place-bound story')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Profile'));
    fireEvent.press(await screen.findByText('Sign out'));

    await waitFor(() => {
      expect(screen.getByLabelText('Search stories')).toBeTruthy();
    });
  });

  it('shows notification entry point for authenticated users and opens notifications', async () => {
    renderNavigator();

    expect(screen.queryByLabelText(/Notifications/)).toBeNull();

    fireEvent.press(await screen.findByLabelText('Login'));
    expect(await screen.findByLabelText('Email address')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Email address'), 'traveler@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.press(screen.getAllByText('Sign in').at(-1)!);

    expect(await screen.findByLabelText('Notifications, 1 unread')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Notifications, 1 unread'));

    expect(await screen.findByText('Notifications')).toBeTruthy();
    expect(await screen.findByText('Aylin liked your story.')).toBeTruthy();
    expect(screen.getByText('1 unread')).toBeTruthy();
  });

  it('opens profile completion after registration and persists the session', async () => {
    renderNavigator();

    fireEvent.press(await screen.findByLabelText('Login'));
    await screen.findByLabelText('Email address');
    fireEvent.press(screen.getByText('Sign up'));

    fireEvent.changeText(screen.getByLabelText('Username'), 'newtraveler');
    fireEvent.changeText(screen.getByLabelText('Email address'), 'newuser@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'Password1');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'Password1');
    fireEvent.press(screen.getAllByText('Create account').at(-1)!);

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeTruthy();
    });

    expect(await storage.get<{ accessToken?: string }>(storageKeys.authSession)).toMatchObject({
      accessToken: 'access-token-123',
    });
  });

  it('returns to the feed after profile completion is submitted', async () => {
    renderNavigator();

    fireEvent.press(await screen.findByLabelText('Login'));
    await screen.findByLabelText('Email address');
    fireEvent.press(screen.getByText('Sign up'));

    fireEvent.changeText(screen.getByLabelText('Username'), 'newtraveler');
    fireEvent.changeText(screen.getByLabelText('Email address'), 'newuser@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'Password1');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'Password1');
    fireEvent.press(screen.getAllByText('Create account').at(-1)!);

    await screen.findByLabelText('Name');

    fireEvent.changeText(screen.getByLabelText('Name'), 'Ada');
    fireEvent.changeText(screen.getByLabelText('Surname'), 'Lovelace');
    fireEvent.press(screen.getByText('Continue'));
    await screen.findByText('Profile photo');
    fireEvent.press(screen.getByText('Continue'));
    await screen.findByText('Location');
    fireEvent.press(screen.getByText('Continue'));
    await screen.findByText('Birth date');
    fireEvent.press(screen.getByText('Continue'));
    await screen.findByText('Bio');
    fireEvent.press(screen.getByText('Finish'));

    await waitFor(() => {
      expect(screen.getByLabelText('Search stories')).toBeTruthy();
    });
  });

  it('falls back to manual sign-in when auto-login after registration fails', async () => {
    let loginAttempts = 0;

    setApiTransport(async (method, config) => {
      if (method === 'GET' && (config.url?.startsWith('/stories/feed/') || config.url?.startsWith('/stories/search/'))) {
        return {
          status: 200,
          data: {
            count: feedResults.length,
            next: null,
            previous: null,
            results: feedResults,
          } as never,
          config,
        };
      }

      if (method === 'GET' && config.url?.startsWith('/stories/map/')) {
        return {
          status: 200,
          data: {
            count: feedResults.length,
            next: null,
            previous: null,
            results: feedResults,
          } as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/stories/story-001/') {
        return {
          status: 200,
          data: storyDetail as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/stories/story-001/comments/') {
        return {
          status: 200,
          data: { results: [] } as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/users/me/') {
        return {
          status: 200,
          data: profileDetail as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/users/12/') {
        return {
          status: 200,
          data: publicProfileDetail as never,
          config,
        };
      }

      if (method === 'GET' && config.url?.startsWith('/stories/?')) {
        return {
          status: 200,
          data: {
            count: feedResults.length,
            next: null,
            previous: null,
            results: feedResults.map((story) => ({
              ...story,
              user: 1,
              narrative: 'A story about the harbor.',
            })),
          } as never,
          config,
        };
      }

      if (method === 'POST' && config.url === '/auth/register/') {
        return {
          status: 201,
          data: {
            message: 'Registration successful. Please verify your email.',
            user: {
              id: 2,
              email: 'newuser@example.com',
              username: 'NewTraveler',
              role: 'registered_user',
            },
          } as never,
          config,
        };
      }

      if (method === 'POST' && config.url === '/auth/login/') {
        loginAttempts += 1;

        if (loginAttempts === 1) {
          throw new Error('Temporary login outage.');
        }

        return {
          status: 200,
          data: {
            access: 'access-token-123',
            refresh: 'refresh-token-123',
            user: {
              id: 1,
              email: 'newuser@example.com',
              username: 'NewTraveler',
              role: 'registered_user',
            },
          } as never,
          config,
        };
      }

      if (method === 'POST' && config.url === '/auth/logout/') {
        return {
          status: 204,
          data: null as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    renderNavigator();

    fireEvent.press(await screen.findByLabelText('Login'));
    await screen.findByLabelText('Email address');
    fireEvent.press(screen.getByText('Sign up'));

    fireEvent.changeText(screen.getByLabelText('Username'), 'newtraveler');
    fireEvent.changeText(screen.getByLabelText('Email address'), 'newuser@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'Password1');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'Password1');
    fireEvent.press(screen.getAllByText('Create account').at(-1)!);

    expect(
      await screen.findAllByText('Your account was created, but automatic sign-in failed. Please sign in manually.'),
    ).toHaveLength(2);
    expect(screen.getByText('Registration successful. Please verify your email.')).toBeTruthy();
    expect(screen.getAllByText('Sign in').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Email address').props.value).toBe('newuser@example.com');

    fireEvent.changeText(screen.getByLabelText('Password'), 'Password1');
    fireEvent.press(screen.getAllByText('Sign in').at(-1)!);

    await waitFor(() => {
      expect(screen.getByLabelText('Profile')).toBeTruthy();
    });
  });

  it('persists search and filter state between feed and map views', async () => {
    (geocodeLocationQuery as jest.Mock).mockResolvedValueOnce(goldenHornBounds);

    renderNavigator();

    await screen.findByLabelText('Search stories');
    fireEvent.changeText(screen.getByLabelText('Search stories'), 'harbor');
    fireEvent.press(screen.getByLabelText('Apply search'));
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.changeText(screen.getByLabelText('Location filter'), 'Golden Horn');
    fireEvent.changeText(screen.getByLabelText('Start year'), '1990');
    fireEvent.changeText(screen.getByLabelText('End year'), '2000');
    expect(await screen.findByText('Filtering by map area.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      expect(screen.getByLabelText('Search stories').props.value).toBe('harbor');
    });

    fireEvent.press(screen.getByLabelText('Map'));
    await screen.findByLabelText('Search stories');
    expect(screen.getByLabelText('Search stories').props.value).toBe('harbor');
    fireEvent.press(screen.getByText('Show filters'));
    expect(screen.getByLabelText('Location filter').props.value).toBe('Golden Horn');
    expect(screen.getByLabelText('Start year').props.value).toBe('1990');
    expect(screen.getByLabelText('End year').props.value).toBe('2000');
    fireEvent.press(screen.getByLabelText('Close filters'));

    fireEvent.press(screen.getByLabelText('Feed'));

    await screen.findByLabelText('Search stories');
    expect(screen.getByLabelText('Search stories').props.value).toBe('harbor');
  });

  it('opens a protected screen after login and returns with the back button', async () => {
    render(
      <AppProviders>
        <RootNavigator />
      </AppProviders>,
    );

    await screen.findByLabelText('Search stories');
    fireEvent.press(screen.getByLabelText('Login'));
    await screen.findByLabelText('Email address');
    fireEvent.changeText(screen.getByLabelText('Email address'), 'traveler@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.press(screen.getAllByText('Sign in').at(-1)!);
    fireEvent.press(await screen.findByLabelText('Submission', {}, { timeout: 3000 }));

    expect(await screen.findByLabelText('Go back')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Go back'));

    await waitFor(() => {
      expect(screen.getByLabelText('Search stories')).toBeTruthy();
    });
  });

  it('returns from story detail to the previous route when back is pressed', async () => {
    render(
      <AppProviders>
        <RootNavigator />
      </AppProviders>,
    );

    await screen.findByLabelText('Read story: Harbor Memory');
    fireEvent.press(screen.getByLabelText('Read story: Harbor Memory'));

    expect(await screen.findByText('Harbor Memory')).toBeTruthy();
    expect(screen.getByLabelText('Go back')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Go back'));

    await waitFor(() => {
      expect(screen.getByLabelText('Search stories')).toBeTruthy();
      expect(screen.getByLabelText('Read story: Harbor Memory')).toBeTruthy();
    });
  });

  it('keeps the selected feed sort after returning from story detail', async () => {
    render(
      <AppProviders>
        <RootNavigator />
      </AppProviders>,
    );

    await screen.findByLabelText('Sort by Most Popular');
    fireEvent.press(screen.getByLabelText('Sort by Most Popular'));

    await waitFor(() => {
      expect(screen.getByLabelText('Sort by Most Popular').props.accessibilityState.selected).toBe(true);
    });

    fireEvent.press(await screen.findByLabelText('Read story: Harbor Memory'));
    expect(await screen.findByLabelText('Go back')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Go back'));

    await waitFor(() => {
      expect(screen.getByLabelText('Read story: Harbor Memory')).toBeTruthy();
      expect(screen.getByLabelText('Sort by Most Popular').props.accessibilityState.selected).toBe(true);
      expect(screen.getByLabelText('Sort by Most Recent').props.accessibilityState.selected).toBe(false);
    });
  });

  it('opens a public profile from the contributor name on story detail', async () => {
    render(
      <AppProviders>
        <RootNavigator />
      </AppProviders>,
    );

    await screen.findByLabelText('Read story: Harbor Memory');
    fireEvent.press(screen.getByLabelText('Read story: Harbor Memory'));

    expect(await screen.findByText('Harbor Memory')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open profile: Aylin'));

    await waitFor(() => {
      expect(screen.getAllByText('User profile')).toHaveLength(2);
      expect(screen.getByText('I write about harbor neighborhoods.')).toBeTruthy();
    });
  });

  it('opens the signed-in user profile when the contributor is the current user', async () => {
    setApiTransport(async (method, config) => {
      if (method === 'GET' && (config.url?.startsWith('/stories/feed/') || config.url?.startsWith('/stories/search/'))) {
        return {
          status: 200,
          data: {
            count: feedResults.length,
            next: null,
            previous: null,
            results: feedResults,
          } as never,
          config,
        };
      }

      if (method === 'GET' && config.url?.startsWith('/stories/map/')) {
        return {
          status: 200,
          data: {
            count: feedResults.length,
            next: null,
            previous: null,
            results: feedResults,
          } as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/stories/story-001/') {
        return {
          status: 200,
          data: {
            ...storyDetail,
            user: 1,
            contributor_name: 'Traveler',
          } as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/stories/story-001/comments/') {
        return {
          status: 200,
          data: { results: [] } as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/users/me/') {
        return {
          status: 200,
          data: profileDetail as never,
          config,
        };
      }

      if (method === 'GET' && config.url?.startsWith('/stories/?')) {
        return {
          status: 200,
          data: {
            count: feedResults.length,
            next: null,
            previous: null,
            results: feedResults.map((story) => ({
              ...story,
              user: 1,
              narrative: 'A story about the harbor.',
            })),
          } as never,
          config,
        };
      }

      if (method === 'POST' && config.url === '/auth/login/') {
        return {
          status: 200,
          data: {
            access: 'access-token-123',
            refresh: 'refresh-token-123',
            user: {
              id: 1,
              email: 'traveler@example.com',
              username: 'Traveler',
              role: 'registered_user',
            },
          } as never,
          config,
        };
      }

      if (method === 'POST' && config.url === '/auth/logout/') {
        return {
          status: 204,
          data: null as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    render(
      <AppProviders>
        <RootNavigator />
      </AppProviders>,
    );

    await screen.findByLabelText('Search stories');
    fireEvent.press(screen.getByLabelText('Login'));
    await screen.findByLabelText('Email address');
    fireEvent.changeText(screen.getByLabelText('Email address'), 'traveler@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.press(screen.getAllByText('Sign in').at(-1)!);

    await screen.findByLabelText('Read story: Harbor Memory');
    fireEvent.press(screen.getByLabelText('Read story: Harbor Memory'));

    expect(await screen.findByText('Harbor Memory')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open profile: Traveler (You)'));

    await waitFor(() => {
      expect(screen.getByText('Signed in as Traveler.')).toBeTruthy();
      expect(screen.getByText('Collecting neighborhood memories.')).toBeTruthy();
    });
  });
});
