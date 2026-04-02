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

function installAuthTransport() {
  setApiTransport(async (method, config) => {
    if (method === 'GET' && (config.url?.startsWith('/stories/feed/') || config.url?.startsWith('/stories/search/'))) {
      return {
        status: 200,
        data: {
          count: 0,
          next: null,
          previous: null,
          results: [],
        } as never,
        config,
      };
    }

    if (method === 'GET' && config.url?.startsWith('/stories/map/')) {
      return {
        status: 200,
        data: {
          count: 0,
          next: null,
          previous: null,
          results: [],
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
});
