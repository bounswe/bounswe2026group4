import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { storage } from '../../../../core/storage/storage';
import { storageKeys } from '../../../../core/storage/keys';
import { apiClient, resetApiTransport, setApiTransport } from '../../../../core/api/client';
import { ApiRequestConfig, interceptors } from '../../../../core/api/interceptors';

function AuthHarness() {
  const { user, isAuthenticated, loading, login, logout } = useAuth();

  const handleRequest = async () => {
    try {
      await apiClient.get('/profile');
    } catch {
      return null;
    }

    return null;
  };

  return (
    <View>
      <Text>{loading ? 'loading' : 'ready'}</Text>
      <Text>{isAuthenticated ? 'authenticated' : 'guest'}</Text>
      <Text>{user?.email ?? 'no-user'}</Text>
      <Pressable onPress={() => login({ email: 'traveler@example.com', password: 'password123' })}>
        <Text>login</Text>
      </Pressable>
      <Pressable onPress={() => logout()}>
        <Text>logout</Text>
      </Pressable>
      <Pressable onPress={handleRequest}>
        <Text>request</Text>
      </Pressable>
    </View>
  );
}

describe('AuthProvider', () => {
  beforeEach(async () => {
    await storage.clear();
    interceptors.clear();
    resetApiTransport();
  });

  it('restores a persisted session on app launch', async () => {
    await storage.set(storageKeys.authSession, {
      token: 'persisted-token',
      user: {
        id: 'user-1',
        name: 'Traveler',
        email: 'traveler@example.com',
        role: 'user',
      },
    });

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    expect(await screen.findByText('authenticated')).toBeTruthy();
    expect(screen.getByText('traveler@example.com')).toBeTruthy();
  });

  it('handles login and logout with persistent storage', async () => {
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    expect(await screen.findByText('guest')).toBeTruthy();
    fireEvent.press(screen.getByText('login'));

    await waitFor(() => {
      expect(screen.getByText('authenticated')).toBeTruthy();
    });

    const storedSession = await storage.get<{ token: string }>(storageKeys.authSession);
    expect(storedSession?.token).toContain('mock-jwt');

    fireEvent.press(screen.getByText('logout'));

    await waitFor(() => {
      expect(screen.getByText('guest')).toBeTruthy();
    });
    expect(await storage.get(storageKeys.authSession)).toBeNull();
  });

  it('attaches the bearer token to outgoing API requests', async () => {
    let authorizationHeader = '';

    setApiTransport(async (_method, config: ApiRequestConfig) => {
      authorizationHeader = config.headers?.Authorization ?? '';

      return {
        status: 200,
        data: { ok: true } as never,
        config,
      };
    });

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    fireEvent.press(await screen.findByText('login'));

    await waitFor(() => {
      expect(screen.getByText('authenticated')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('request'));

    await waitFor(() => {
      expect(authorizationHeader).toContain('Bearer mock-jwt');
    });
  });

  it('clears auth state when the API returns 401', async () => {
    setApiTransport(async () => {
      throw { response: { status: 401 } };
    });

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    fireEvent.press(await screen.findByText('login'));

    await waitFor(() => {
      expect(screen.getByText('authenticated')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('request'));

    await waitFor(() => {
      expect(screen.getByText('guest')).toBeTruthy();
    });
    expect(await storage.get(storageKeys.authSession)).toBeNull();
  });
});
