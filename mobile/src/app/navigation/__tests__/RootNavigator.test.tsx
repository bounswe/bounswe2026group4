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

  it('redirects unauthenticated users to the login flow for protected screens', async () => {
    renderNavigator();

    expect(await screen.findByLabelText('Search stories')).toBeTruthy();

    fireEvent.press(screen.getByText('Profile'));

    expect(
      await screen.findByText('Sign in to your account to explore and share local history stories.'),
    ).toBeTruthy();
  });

  it('allows access to protected screens after login and returns to a public route on logout', async () => {
    renderNavigator();

    fireEvent.press(await screen.findByText('Submission', {}, { timeout: 3000 }));
    expect(
      await screen.findByText('Sign in to your account to explore and share local history stories.'),
    ).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Email address'), 'traveler@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.press(screen.getAllByText('Sign in').at(-1)!);

    await waitFor(() => {
      expect(screen.getByText('Submit a story')).toBeTruthy();
    });
    expect(screen.getByText('Share a place-bound story')).toBeTruthy();

    fireEvent.press(screen.getByText('Log out'));

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

    fireEvent.press(screen.getByText('Map'));
    await screen.findByLabelText('Search stories');
    fireEvent.press(screen.getByText('Feed'));

    await screen.findByLabelText('Search stories');
    expect(screen.getByLabelText('Search stories').props.value).toBe('harbor');
  });

  it('shows a back button for protected screens and returns to the previous public route', async () => {
    render(
      <AppProviders>
        <RootNavigator />
      </AppProviders>,
    );

    await screen.findByLabelText('Search stories');
    fireEvent.press(screen.getByText('Submission'));

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
});
