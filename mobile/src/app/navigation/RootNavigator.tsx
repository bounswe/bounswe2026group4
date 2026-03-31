import React, { useEffect, useState } from 'react';
import { StatusBar, Text, View } from 'react-native';
import { Session } from '../../core/auth/session';
import { useAppTheme } from '../../core/hooks/useAppTheme';
import { logoutCurrentUser, restoreAuthSession } from '../../features/auth/application/useCases';
import { AuthScreen } from '../../features/auth/presentation/screens/AuthScreen';
import { Button, Loader } from '../../shared';

export function RootNavigator() {
  const { colors, spacing, typography, colorScheme } = useAppTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    restoreAuthSession()
      .then((restoredSession) => {
        if (isMounted) {
          setSession(restoredSession);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsRestoring(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isRestoring) {
    return (
      <>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        <Loader fullScreen message="Restoring session..." />
      </>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        <AuthScreen onAuthenticated={setSession} />
      </>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
        justifyContent: 'center',
      }}
    >
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
        <Text style={{ color: colors.primary, fontWeight: '700' }}>Authenticated</Text>
        <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
          Welcome, {session.user.username}
        </Text>
        <Text style={{ color: colors.muted, fontSize: typography.body }}>
          The app has stored your access and refresh tokens locally after a successful call to the
          backend login endpoint.
        </Text>
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: colors.text }}>Email: {session.user.email}</Text>
          <Text style={{ color: colors.text }}>Role: {session.role}</Text>
        </View>
        <Button
          variant="secondary"
          disabled={isLoggingOut}
          onPress={async () => {
            setIsLoggingOut(true);
            try {
              await logoutCurrentUser(session);
              setSession(null);
            } finally {
              setIsLoggingOut(false);
            }
          }}
        >
          {isLoggingOut ? 'Signing out...' : 'Sign out'}
        </Button>
      </View>
    </View>
  );
}
