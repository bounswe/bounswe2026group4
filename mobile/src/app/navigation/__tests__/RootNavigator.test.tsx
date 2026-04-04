import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RootNavigator } from '../RootNavigator';
import { storage } from '../../../core/storage/storage';
import { interceptors } from '../../../core/api/interceptors';
import { resetApiTransport, setApiTransport } from '../../../core/api/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { ToastProvider } from '../../../shared/toast/ToastProvider';
import { AuthProvider } from '../../../features/auth/context/AuthContext';
import { SearchFiltersProvider } from '../../../features/search/presentation/context/SearchFiltersContext';
import { NavigationProvider } from '../../providers/NavigationProvider';
import { AppProviders } from '../../providers/AppProviders';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, right: 0, bottom: 34, left: 0 },
};

function renderNavigator() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SearchFiltersProvider>
              <NavigationProvider>
                <RootNavigator />
              </NavigationProvider>
            </SearchFiltersProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
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
}

describe('RootNavigator auth flow', () => {
  beforeEach(async () => {
    await storage.clear();
    interceptors.clear();
    resetApiTransport();
    installAuthTransport();
  });

  it('shows a message instead of redirecting unauthenticated users for protected screens', async () => {
    renderNavigator();

    expect(await screen.findByLabelText('Search stories')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Submission'));

    expect(await screen.findByText('Please sign in to submit a story.')).toBeTruthy();
    expect(screen.getByLabelText('Search stories')).toBeTruthy();
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

  it('keeps applied feed filters when navigating to map and back', async () => {
    renderNavigator();

    await screen.findByLabelText('Search stories');
    fireEvent.changeText(screen.getByLabelText('Search stories'), 'harbor');
    fireEvent.press(screen.getByLabelText('Apply search'));

    await waitFor(() => {
      expect(screen.getByLabelText('Search stories').props.value).toBe('harbor');
    });

    fireEvent.press(screen.getByLabelText('Map'));
    await screen.findByLabelText('Search stories');
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
    fireEvent.press(screen.getByLabelText('Open profile: Traveler'));

    await waitFor(() => {
      expect(screen.getByText('Signed in as Traveler.')).toBeTruthy();
      expect(screen.getByText('Collecting neighborhood memories.')).toBeTruthy();
    });
  });
});
