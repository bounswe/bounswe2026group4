import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppProviders } from '../../providers/AppProviders';
import { RootNavigator } from '../RootNavigator';
import { storage } from '../../../core/storage/storage';
import { interceptors } from '../../../core/api/interceptors';
import { resetApiTransport, setApiTransport } from '../../../core/api/client';

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
    render(
      <AppProviders>
        <RootNavigator />
      </AppProviders>,
    );

    expect(await screen.findByLabelText('Search stories')).toBeTruthy();

    fireEvent.press(screen.getByText('Profile'));

    expect(await screen.findByText('Sign in to the mobile app')).toBeTruthy();
  });

  it('allows access to protected screens after login and returns to a public route on logout', async () => {
    render(
      <AppProviders>
        <RootNavigator />
      </AppProviders>,
    );

    fireEvent.press(await screen.findByText('Submission'));
    expect(await screen.findByText('Sign in to the mobile app')).toBeTruthy();

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
    render(
      <AppProviders>
        <RootNavigator />
      </AppProviders>,
    );

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
