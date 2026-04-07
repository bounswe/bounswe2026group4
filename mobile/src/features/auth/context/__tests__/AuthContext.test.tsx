import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { storage } from '../../../../core/storage/storage';
import { storageKeys } from '../../../../core/storage/keys';
import { apiClient, resetApiTransport, setApiTransport } from '../../../../core/api/client';
import { ApiRequestConfig, interceptors } from '../../../../core/api/interceptors';

const loginResponse = {
  access: 'access-token-123',
  refresh: 'refresh-token-123',
  user: {
    id: 1,
    email: 'traveler@example.com',
    username: 'Traveler',
    role: 'registered_user' as const,
  },
};

function AuthHarness() {
  const { user, isAuthenticated, loading, login, register, logout, updateUser } = useAuth();

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
      <Text>{user?.username ?? 'no-username'}</Text>
      <Pressable
        onPress={() =>
          login({ email: 'traveler@example.com', password: 'password123' }).catch(() => undefined)
        }
      >
        <Text>login</Text>
      </Pressable>
      <Pressable onPress={() => logout()}>
        <Text>logout</Text>
      </Pressable>
      <Pressable onPress={() => updateUser({ username: 'Traveler Updated' })}>
        <Text>update-user</Text>
      </Pressable>
      <Pressable
        onPress={() =>
          register({
            username: 'traveler',
            email: 'traveler@example.com',
            password: 'Password1',
            confirmPassword: 'Password1',
          }).catch(() => undefined)
        }
      >
        <Text>register</Text>
      </Pressable>
      <Pressable onPress={handleRequest}>
        <Text>request</Text>
      </Pressable>
    </View>
  );
}

function installAuthTransport(options?: {
  unauthorizedOnProfile?: boolean;
  unauthorizedOnceOnProfile?: boolean;
  refreshFails?: boolean;
  rotatedRefreshToken?: string;
  onProfileRequest?: (config: ApiRequestConfig) => void;
}) {
  let didRejectProfileOnce = false;

  setApiTransport(async (method, config) => {
    if (method === 'POST' && config.url === '/auth/login/') {
      return {
        status: 200,
        data: loginResponse as never,
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

    if (method === 'POST' && config.url === '/auth/register/') {
      return {
        status: 201,
        data: {
          message: 'Registration successful. Please verify your email.',
          user: {
            id: 2,
            email: 'traveler@example.com',
            username: 'traveler',
            role: 'registered_user',
          },
        } as never,
        config,
      };
    }

    if (method === 'POST' && config.url === '/auth/token/refresh/') {
      if (options?.refreshFails) {
        throw { response: { status: 401, config } };
      }

      return {
        status: 200,
        data: {
          access: 'access-token-refreshed',
          refresh: options?.rotatedRefreshToken ?? 'refresh-token-rotated',
        } as never,
        config,
      };
    }

    if (method === 'GET' && config.url === '/profile') {
      options?.onProfileRequest?.(config);

      if (options?.unauthorizedOnceOnProfile && !didRejectProfileOnce) {
        didRejectProfileOnce = true;
        throw { response: { status: 401, config } };
      }

      if (options?.unauthorizedOnProfile) {
        throw { response: { status: 401, config } };
      }

      return {
        status: 200,
        data: { ok: true } as never,
        config,
      };
    }

    throw new Error(`Unexpected request: ${method} ${config.url}`);
  });
}

describe('AuthProvider', () => {
  beforeEach(async () => {
    await storage.clear();
    interceptors.clear();
    resetApiTransport();
  });

  it('restores a persisted session on app launch', async () => {
    await storage.set(storageKeys.authSession, {
      accessToken: 'persisted-access-token',
      refreshToken: 'persisted-refresh-token',
      role: 'user',
      user: {
        id: 1,
        email: 'traveler@example.com',
        username: 'Traveler',
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
    installAuthTransport();

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

    const storedSession = await storage.get<{ accessToken: string }>(storageKeys.authSession);
    expect(storedSession?.accessToken).toBe(loginResponse.access);

    fireEvent.press(screen.getByText('logout'));

    await waitFor(() => {
      expect(screen.getByText('guest')).toBeTruthy();
    });
    expect(await storage.get(storageKeys.authSession)).toBeNull();
  });

  it('refreshes the session and retries the request after an expired access token', async () => {
    let authorizationHeaders: string[] = [];

    installAuthTransport({
      unauthorizedOnceOnProfile: true,
      rotatedRefreshToken: 'refresh-token-456',
      onProfileRequest(config) {
        authorizationHeaders = [...authorizationHeaders, config.headers?.Authorization ?? ''];
      },
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
      expect(authorizationHeaders).toEqual([
        `Bearer ${loginResponse.access}`,
        'Bearer access-token-refreshed',
      ]);
    });

    expect(screen.getByText('authenticated')).toBeTruthy();

    const storedSession = await storage.get<{ accessToken: string; refreshToken: string }>(storageKeys.authSession);
    expect(storedSession).toMatchObject({
      accessToken: 'access-token-refreshed',
      refreshToken: 'refresh-token-456',
    });
  });

  it('clears auth state when token refresh fails', async () => {
    installAuthTransport({
      unauthorizedOnceOnProfile: true,
      refreshFails: true,
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

  it('updates the stored auth user when profile data changes', async () => {
    installAuthTransport();

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    fireEvent.press(await screen.findByText('login'));

    await waitFor(() => {
      expect(screen.getByText('authenticated')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('update-user'));

    await waitFor(() => {
      expect(screen.getByText('Traveler Updated')).toBeTruthy();
    });

    const storedSession = await storage.get<{ user?: { username?: string } }>(storageKeys.authSession);
    expect(storedSession?.user?.username).toBe('Traveler Updated');
  });

  it('registers without creating a persisted session', async () => {
    installAuthTransport();

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    expect(await screen.findByText('guest')).toBeTruthy();
    fireEvent.press(screen.getByText('register'));

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeTruthy();
    });

    expect(screen.getByText('guest')).toBeTruthy();
    expect(await storage.get(storageKeys.authSession)).toBeNull();
  });

  it('attaches the bearer token to outgoing API requests', async () => {
    let authorizationHeader = '';

    installAuthTransport({
      onProfileRequest(config) {
        authorizationHeader = config.headers?.Authorization ?? '';
      },
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
      expect(authorizationHeader).toBe(`Bearer ${loginResponse.access}`);
    });
  });

  it('clears auth state when the API returns 401', async () => {
    installAuthTransport({ unauthorizedOnProfile: true });

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

  it('resets loading when login fails', async () => {
    setApiTransport(async (method, config) => {
      if (method === 'POST' && config.url === '/auth/login/') {
        throw new Error('Backend rejected this device host.');
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    expect(await screen.findByText('guest')).toBeTruthy();
    fireEvent.press(screen.getByText('login'));

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeTruthy();
    });
    expect(screen.getByText('guest')).toBeTruthy();
  });
});
