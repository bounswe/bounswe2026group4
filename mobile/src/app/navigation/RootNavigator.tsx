import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { Loader, Screen } from '../../shared';
import { ROUTES } from './routes';
import { useAuth } from '../../features/auth';
import { AuthScreen } from '../../features/auth';
import { useAppTheme } from '../../core/hooks/useAppTheme';
import { ProtectedScreen } from './ProtectedScreen';
import { FeedScreen } from '../../features/feed';
import { ProfileScreen } from '../../features/profile';
import { SubmissionScreen } from '../../features/submissions';
import { navigationRef } from './navigationRef';
import { MapScreen } from '../../features/map';
import { StoryScreen } from '../../features/stories';
import { StoryFilters } from '../../features/stories/domain/repositories';

type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
interface RouteSnapshot {
  route: AppRoute;
  storyId?: string | null;
}

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

function BackButton({ onPress }: { onPress: () => void }) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '700' }}>{'<'}</Text>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Back</Text>
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
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [hasResolvedInitialSession, setHasResolvedInitialSession] = useState(false);
  const [feedFilters, setFeedFilters] = useState<StoryFilters>({});
  const [backStack, setBackStack] = useState<RouteSnapshot[]>([]);

  const currentSnapshot = useMemo<RouteSnapshot>(
    () => ({
      route: currentRoute,
      storyId: currentRoute === ROUTES.STORY_DETAIL ? activeStoryId : null,
    }),
    [activeStoryId, currentRoute],
  );
  const [redirectTarget, setRedirectTarget] = useState<RouteSnapshot>({ route: ROUTES.PROFILE });
  const canGoBack = backStack.length > 0;

  useEffect(() => {
    if (!loading) {
      setHasResolvedInitialSession(true);
    }
  }, [loading]);

  const restoreSnapshot = useCallback((snapshot: RouteSnapshot) => {
    setCurrentRoute(snapshot.route);
    setActiveStoryId(snapshot.route === ROUTES.STORY_DETAIL ? snapshot.storyId ?? null : null);
  }, []);

  const navigateToSnapshot = useCallback(
    (snapshot: RouteSnapshot, options?: { resetStack?: boolean; preserveCurrent?: boolean }) => {
      if (
        !options?.resetStack &&
        snapshot.route === currentSnapshot.route &&
        snapshot.storyId === currentSnapshot.storyId
      ) {
        return;
      }

      if (options?.resetStack) {
        setBackStack([]);
      } else if (options?.preserveCurrent !== false) {
        setBackStack((current) => {
          const previous = current[current.length - 1];

          if (
            previous?.route === currentSnapshot.route &&
            previous?.storyId === currentSnapshot.storyId
          ) {
            return current;
          }

          return [...current, currentSnapshot];
        });
      }

      restoreSnapshot(snapshot);
    },
    [currentSnapshot, restoreSnapshot],
  );

  const handleBack = useCallback(() => {
    setBackStack((current) => {
      if (!current.length) {
        return current;
      }

      const nextStack = [...current];
      const previousSnapshot = nextStack.pop();

      if (previousSnapshot) {
        restoreSnapshot(previousSnapshot);
      }

      return nextStack;
    });
  }, [restoreSnapshot]);

  useEffect(() => {
    navigationRef.redirectToAuth = () => {
      setRedirectTarget(currentSnapshot);
      navigateToSnapshot({ route: ROUTES.AUTH });
    };
    navigationRef.redirectToPublic = () => {
      setRedirectTarget({ route: ROUTES.PROFILE });
      navigateToSnapshot({ route: ROUTES.FEED }, { resetStack: true, preserveCurrent: false });
    };
    navigationRef.navigate = (route) => {
      navigateToSnapshot({ route });
    };

    return () => {
      navigationRef.redirectToAuth = undefined;
      navigationRef.redirectToPublic = undefined;
      navigationRef.navigate = undefined;
    };
  }, [currentSnapshot, navigateToSnapshot]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) {
        return false;
      }

      handleBack();
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [canGoBack, handleBack]);

  const handleNavigate = (route: AppRoute) => {
    if (route === ROUTES.FEED || route === ROUTES.MAP) {
      navigateToSnapshot({ route }, { resetStack: true, preserveCurrent: false });
      return;
    }

    if (route === ROUTES.AUTH) {
      setRedirectTarget(currentSnapshot);
      navigateToSnapshot({ route });
      return;
    }

    if (!isAuthenticated && protectedRoutes.includes(route)) {
      setRedirectTarget({ route });
      navigateToSnapshot({ route });
      return;
    }

    navigateToSnapshot({ route });
  };

  const handleLoginComplete = () => {
    setBackStack((current) => {
      const nextStack = [...current];
      const previousSnapshot = nextStack[nextStack.length - 1];

      if (
        previousSnapshot?.route === redirectTarget.route &&
        previousSnapshot?.storyId === redirectTarget.storyId
      ) {
        nextStack.pop();
      }

      return nextStack;
    });
    restoreSnapshot(redirectTarget);
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleOpenStoryDetail = (storyId: string) => {
    navigateToSnapshot({ route: ROUTES.STORY_DETAIL, storyId });
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
        description="Unauthenticated users are redirected to the login flow before they can view profile data."
        onAuthenticated={handleLoginComplete}
      >
        <ScreenShell
          title="Your profile"
          description={`Authenticated as ${user?.username ?? 'Unknown user'}.`}
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
  } else if (currentRoute === ROUTES.MAP) {
    content = (
      <ScreenShell
        title="Story map"
        description="Discover local history through an interactive map designed around place-based exploration."
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
        onGoBack={handleBack}
      />
    );
  } else {
    content = (
      <ScreenShell
        title="Story feed"
        description="Public screens remain accessible while auth state is shared across the app."
        framed={false}
        fillContent
        hideHeader
      >
        <FeedScreen
          initialFilters={feedFilters}
          onFiltersChange={setFeedFilters}
          onOpenStory={handleOpenStoryDetail}
        />
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {canGoBack ? <BackButton onPress={handleBack} /> : null}
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', flexShrink: 1 }}>
            Local History Story Map
          </Text>
        </View>
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
