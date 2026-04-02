import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppLayout } from '../AppLayout';
import { NavigationProvider } from '../../providers/NavigationProvider';
import { AuthProvider } from '../../../features/auth/presentation/context/AuthContext';
import { Session } from '../../../core/auth/session';

const authenticatedSession: Session = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  role: 'user',
  user: {
    id: 7,
    email: 'mert@example.com',
    username: 'mertk',
    role: 'user',
  },
};

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, right: 0, bottom: 34, left: 0 },
};

function renderLayout({
  initialSession = null,
  initialRoute = 'map',
}: {
  initialSession?: Session | null;
  initialRoute?: 'map' | 'feed' | 'submission' | 'profile' | 'login' | 'register';
}) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <AuthProvider initialSession={initialSession} skipRestore>
        <NavigationProvider initialRoute={initialRoute}>
          <AppLayout>
            <Text>Screen content</Text>
          </AppLayout>
        </NavigationProvider>
      </AuthProvider>
    </SafeAreaProvider>,
  );
}

describe('AppLayout', () => {
  it('shows guest navigation and auth actions when the user is unauthenticated', () => {
    const screen = renderLayout({ initialRoute: 'login' });

    expect(screen.getByTestId('main-route-map')).toBeTruthy();
    expect(screen.getByTestId('main-route-feed')).toBeTruthy();
    expect(screen.queryByTestId('main-route-submission')).toBeNull();
    expect(screen.queryByTestId('main-route-profile')).toBeNull();
    expect(screen.getByTestId('auth-route-login')).toBeTruthy();
    expect(screen.getByTestId('auth-route-register')).toBeTruthy();
    expect(screen.queryByText('Logout')).toBeNull();
  });

  it('shows authenticated navigation and account controls when the user is signed in', () => {
    const screen = renderLayout({
      initialSession: authenticatedSession,
      initialRoute: 'profile',
    });

    expect(screen.getByTestId('main-route-map')).toBeTruthy();
    expect(screen.getByTestId('main-route-feed')).toBeTruthy();
    expect(screen.getByTestId('main-route-submission')).toBeTruthy();
    expect(screen.getByTestId('main-route-profile')).toBeTruthy();
    expect(screen.queryByTestId('auth-route-login')).toBeNull();
    expect(screen.queryByTestId('auth-route-register')).toBeNull();
    expect(screen.getByText('mertk')).toBeTruthy();
    expect(screen.getByText('Logout')).toBeTruthy();
  });

  it('marks the active route in the mobile tab bar', () => {
    const screen = renderLayout({
      initialSession: authenticatedSession,
      initialRoute: 'feed',
    });

    expect(screen.getByTestId('main-route-feed').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('main-route-map').props.accessibilityState.selected).toBe(false);
  });
});
