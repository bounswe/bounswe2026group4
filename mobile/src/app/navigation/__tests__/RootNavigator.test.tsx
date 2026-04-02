import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppProviders } from '../../providers/AppProviders';
import { RootNavigator } from '../RootNavigator';
import { storage } from '../../../core/storage/storage';
import { interceptors } from '../../../core/api/interceptors';
import { resetApiTransport, setApiTransport } from '../../../core/api/client';

function installAuthTransport() {
  setApiTransport(async (method, config) => {
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

    expect(await screen.findByText('Story feed')).toBeTruthy();

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
      expect(screen.getByText('Story feed')).toBeTruthy();
    });
  });
});
