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
      <Pressable onPress={handleRequest}>
        <Text>request</Text>
      </Pressable>
    </View>
  );
}

function installAuthTransport(options?: {
  unauthorizedOnProfile?: boolean;
  onProfileRequest?: (config: ApiRequestConfig) => void;
}) {
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

    if (method === 'GET' && config.url === '/profile') {
      options?.onProfileRequest?.(config);

      if (options?.unauthorizedOnProfile) {
        throw { response: { status: 401 } };
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
