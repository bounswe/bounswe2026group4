import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppProviders } from '../../providers/AppProviders';
import { RootNavigator } from '../RootNavigator';
import { storage } from '../../../core/storage/storage';
import { interceptors } from '../../../core/api/interceptors';
import { resetApiTransport } from '../../../core/api/client';

describe('RootNavigator auth flow', () => {
  beforeEach(async () => {
    await storage.clear();
    interceptors.clear();
    resetApiTransport();
  });

  it('redirects unauthenticated users to the login flow for protected screens', async () => {
    render(
      <AppProviders>
        <RootNavigator />
      </AppProviders>,
    );

    expect(await screen.findByText('Story feed')).toBeTruthy();

    fireEvent.press(screen.getByText('Profile'));

    expect(await screen.findByText('Sign in to continue')).toBeTruthy();
  });

  it('allows access to protected screens after login and returns to a public route on logout', async () => {
    render(
      <AppProviders>
        <RootNavigator />
      </AppProviders>,
    );

    fireEvent.press(await screen.findByText('Submission'));
    expect(await screen.findByText('Sign in to continue')).toBeTruthy();

    fireEvent.press(screen.getByText('Sign in'));

    await waitFor(() => {
      expect(screen.getByText('Submit a story')).toBeTruthy();
    });
    expect(screen.getByText('Submission screen placeholder')).toBeTruthy();

    fireEvent.press(screen.getByText('Log out'));

    await waitFor(() => {
      expect(screen.getByText('Story feed')).toBeTruthy();
    });
  });
});
