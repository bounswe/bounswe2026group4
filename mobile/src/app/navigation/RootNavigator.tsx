import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { Loader, Screen } from '../../shared';
import { ROUTES } from './routes';
import { useAuth, AuthScreen } from '../../features/auth';
import { useAppTheme } from '../../core/hooks/useAppTheme';
import { ProtectedScreen } from './ProtectedScreen';
import { FeedScreen } from '../../features/feed';
import { ProfileScreen } from '../../features/profile';
import { SubmissionScreen } from '../../features/submissions';
import { navigationRef } from './navigationRef';
import { MapScreen } from '../../features/map';
import { StoryScreen } from '../../features/stories';

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
  framed = true,
  scrollable = false,
  fillContent = false,
  hideHeader = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  framed?: boolean;
  scrollable?: boolean;
  fillContent?: boolean;
  hideHeader?: boolean;
}) {
  const { colors, spacing, typography } = useAppTheme();

  const innerContent = (
    <>
      {hideHeader ? null : (
        <>
          <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>{title}</Text>
          <Text style={{ marginTop: spacing.sm, color: colors.muted }}>{description}</Text>
        </>
      )}
      {framed ? (
        <View
          style={{
            marginTop: hideHeader ? 0 : spacing.xl,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 20,
            padding: spacing.lg,
            backgroundColor: colors.surface,
            flex: fillContent ? 1 : undefined,
          }}
        >
          {children}
        </View>
      ) : (
        <View style={{ marginTop: hideHeader ? 0 : spacing.xl, flex: fillContent ? 1 : undefined }}>{children}</View>
      )}
    </>
  );

  if (scrollable) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {innerContent}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, padding: spacing.lg, backgroundColor: colors.background }}>
      {innerContent}
    </View>
  );
}

export function RootNavigator() {
  const { isAuthenticated, loading, logout, user } = useAuth();
  const { colors, spacing } = useAppTheme();
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(ROUTES.FEED);
  const [redirectRoute, setRedirectRoute] = useState<AppRoute>(ROUTES.PROFILE);
  const [lastPublicRoute, setLastPublicRoute] = useState<AppRoute>(ROUTES.FEED);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [hasResolvedInitialSession, setHasResolvedInitialSession] = useState(false);

  useEffect(() => {
    if (!loading) {
      setHasResolvedInitialSession(true);
    }
  }, [loading]);

  useEffect(() => {
    navigationRef.redirectToAuth = () => {
      setRedirectRoute(currentRoute);
      setCurrentRoute(ROUTES.AUTH);
    };
    navigationRef.redirectToPublic = () => {
      setRedirectRoute(ROUTES.PROFILE);
      setCurrentRoute(ROUTES.FEED);
    };
    navigationRef.navigate = (route) => {
      setCurrentRoute(route);
    };

    return () => {
      navigationRef.redirectToAuth = undefined;
      navigationRef.redirectToPublic = undefined;
      navigationRef.navigate = undefined;
    };
  }, [currentRoute]);

  const handleNavigate = (route: AppRoute) => {
    if (route === ROUTES.FEED || route === ROUTES.MAP) {
      setLastPublicRoute(route);
    }

    if (!isAuthenticated && protectedRoutes.includes(route)) {
      setRedirectRoute(route);
      setCurrentRoute(route);
      return;
    }

    setCurrentRoute(route);
  };

  const handleLoginComplete = () => {
    setCurrentRoute(redirectRoute);
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleOpenStoryDetail = (storyId: string) => {
    setActiveStoryId(storyId);
    setCurrentRoute(ROUTES.STORY_DETAIL);
  };

  if (!hasResolvedInitialSession && loading) {
    return (
      <Screen>
        <StatusBar barStyle="dark-content" />
        <Loader fullScreen message="Restoring session..." />
      </Screen>
    );
  }

  let content: React.ReactNode;

  if (currentRoute === ROUTES.AUTH) {
    content = <AuthScreen onAuthenticated={handleLoginComplete} />;
  } else if (currentRoute === ROUTES.PROFILE) {
    content = (
      <ProtectedScreen
        title="Profile requires sign-in"
        description="Sign in to view your profile."
        onAuthenticated={handleLoginComplete}
      >
        <ScreenShell
          title="Your profile"
          description={user?.username ? `Signed in as ${user.username}.` : 'Your account details.'}
        >
          <ProfileScreen />
        </ScreenShell>
      </ProtectedScreen>
    );
  } else if (currentRoute === ROUTES.SUBMISSION) {
    content = (
      <ProtectedScreen
        title="Submission requires sign-in"
        description="Sign in to submit a story."
        onAuthenticated={handleLoginComplete}
      >
        <ScreenShell
          title="Submit a story"
          description="Share a place-based story."
        >
          <SubmissionScreen />
        </ScreenShell>
      </ProtectedScreen>
    );
  } else if (currentRoute === ROUTES.MAP) {
    content = (
      <ScreenShell
        title="Story map"
        description="Explore stories by place."
        framed={false}
        scrollable
      >
        <MapScreen onOpenStory={handleOpenStoryDetail} />
      </ScreenShell>
    );
  } else if (currentRoute === ROUTES.STORY_DETAIL && activeStoryId) {
    content = (
      <StoryScreen
        storyId={activeStoryId}
        session={user ? { role: user.role } : undefined}
        onRequestLogin={() => handleNavigate(ROUTES.AUTH)}
        onGoBack={() => handleNavigate(lastPublicRoute)}
      />
    );
  } else {
    content = (
      <ScreenShell
        title="Story feed"
        description="Explore local history stories."
        framed={false}
        fillContent
        hideHeader
      >
        <FeedScreen onOpenStory={handleOpenStoryDetail} />
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
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>StoryMap</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <ShellButton label="Feed" active={currentRoute === ROUTES.FEED} onPress={() => handleNavigate(ROUTES.FEED)} />
          <ShellButton label="Map" active={currentRoute === ROUTES.MAP} onPress={() => handleNavigate(ROUTES.MAP)} />
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
      <View style={{ flex: 1, backgroundColor: colors.background }}>{content}</View>
    </Screen>
  );
}
