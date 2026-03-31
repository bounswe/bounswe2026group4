import React, { useEffect, useState } from 'react';
import { Pressable, StatusBar, Text, View } from 'react-native';
import { Screen } from '../../shared/ui/Screen';
import { ROUTES } from './routes';
import { useAuth } from '../../features/auth';
import { AuthScreen } from '../../features/auth';
import { useAppTheme } from '../../core/hooks/useAppTheme';
import { ProtectedScreen } from './ProtectedScreen';
import { FeedScreen } from '../../features/feed';
import { ProfileScreen } from '../../features/profile';
import { SubmissionScreen } from '../../features/submissions';

type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

const protectedRoutes: AppRoute[] = [ROUTES.PROFILE, ROUTES.SUBMISSION];

function ShellButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, spacing } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Text style={{ color: active ? colors.background : colors.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function ScreenShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View style={{ flex: 1, padding: spacing.lg }}>
      <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>{title}</Text>
      <Text style={{ marginTop: spacing.sm, color: colors.muted }}>{description}</Text>
      <View
        style={{
          marginTop: spacing.xl,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 20,
          padding: spacing.lg,
          backgroundColor: colors.surface,
        }}
      >
        {children}
      </View>
    </View>
  );
}

export function RootNavigator() {
  const { isAuthenticated, logout, user } = useAuth();
  const { colors, spacing } = useAppTheme();
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(ROUTES.FEED);
  const [redirectRoute, setRedirectRoute] = useState<AppRoute>(ROUTES.PROFILE);

  useEffect(() => {
    if (!isAuthenticated && protectedRoutes.includes(currentRoute)) {
      setRedirectRoute(currentRoute);
      setCurrentRoute(ROUTES.AUTH);
    }
  }, [currentRoute, isAuthenticated]);

  const handleNavigate = (route: AppRoute) => {
    if (!isAuthenticated && protectedRoutes.includes(route)) {
      setRedirectRoute(route);
      setCurrentRoute(ROUTES.AUTH);
      return;
    }

    setCurrentRoute(route);
  };

  const handleLoginComplete = () => {
    setCurrentRoute(redirectRoute);
  };

  const handleLogout = async () => {
    await logout();
    setCurrentRoute(ROUTES.FEED);
  };

  let content: React.ReactNode;

  if (currentRoute === ROUTES.AUTH) {
    content = <AuthScreen onAuthenticated={handleLoginComplete} />;
  } else if (currentRoute === ROUTES.PROFILE) {
    content = (
      <ProtectedScreen
        title="Profile requires sign-in"
        description="Unauthenticated users are redirected to the login flow before they can view profile data."
        onAuthenticated={handleLoginComplete}
      >
        <ScreenShell
          title="Your profile"
          description={`Authenticated as ${user?.name ?? 'Unknown user'}.`}
        >
          <ProfileScreen />
        </ScreenShell>
      </ProtectedScreen>
    );
  } else if (currentRoute === ROUTES.SUBMISSION) {
    content = (
      <ProtectedScreen
        title="Submission requires sign-in"
        description="Story submission is guarded so only authenticated users can access it."
        onAuthenticated={handleLoginComplete}
      >
        <ScreenShell
          title="Submit a story"
          description="Authenticated submission flow is ready for future form work."
        >
          <SubmissionScreen />
        </ScreenShell>
      </ProtectedScreen>
    );
  } else {
    content = (
      <ScreenShell
        title="Story feed"
        description="Public screens remain accessible while auth state is shared across the app."
      >
        <FeedScreen />
      </ScreenShell>
    );
  }

  return (
    <Screen>
      <StatusBar barStyle="dark-content" />
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: spacing.md,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Local History Story Map</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <ShellButton label="Feed" active={currentRoute === ROUTES.FEED} onPress={() => handleNavigate(ROUTES.FEED)} />
          <ShellButton
            label="Profile"
            active={currentRoute === ROUTES.PROFILE}
            onPress={() => handleNavigate(ROUTES.PROFILE)}
          />
          <ShellButton
            label="Submission"
            active={currentRoute === ROUTES.SUBMISSION}
            onPress={() => handleNavigate(ROUTES.SUBMISSION)}
          />
          <ShellButton
            label={isAuthenticated ? 'Log out' : 'Login'}
            active={currentRoute === ROUTES.AUTH}
            onPress={isAuthenticated ? handleLogout : () => handleNavigate(ROUTES.AUTH)}
          />
        </View>
      </View>
      {content}
    </Screen>
  );
}
