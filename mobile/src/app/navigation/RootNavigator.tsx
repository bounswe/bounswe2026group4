import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, NativeScrollEvent, NativeSyntheticEvent, Pressable, RefreshControl, ScrollView, StatusBar, Text, useWindowDimensions, View } from 'react-native';
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
import { StorySearchControls } from '../../features/search/presentation/components/StorySearchControls';
import { useToast } from '../../shared/hooks/useToast';

type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
interface RouteSnapshot {
  route: AppRoute;
  storyId?: string | null;
  userId?: string | null;
}

const protectedRoutes: AppRoute[] = [ROUTES.PROFILE, ROUTES.SUBMISSION];

function BackButton({ onPress }: { onPress: () => void }) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={onPress}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: spacing.xs + 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '700' }}>{'<'}</Text>
      <Text style={{ color: colors.text, fontSize: typography.body, fontWeight: '700' }}>Back</Text>
    </Pressable>
  );
}

function TopIconButton({
  label,
  onPress,
  filled = false,
}: {
  label: string;
  onPress: () => void;
  filled?: boolean;
}) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 42,
        height: 42,
        paddingHorizontal: spacing.md,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: filled ? 0 : 1,
        borderColor: colors.border,
        backgroundColor: filled ? colors.primary : colors.background,
        opacity: pressed ? 0.88 : 1,
      })}
    >
      <Text style={{ color: filled ? colors.background : colors.text, fontSize: typography.caption + 1, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function BottomNavButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        style={{
          color: active ? colors.text : colors.muted,
          fontSize: typography.body,
          fontWeight: active ? '800' : '600',
        }}
      >
        {label}
      </Text>
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
  active = false,
  preservedScrollY = 0,
  onScrollOffsetChange,
}: {
  title: string;
  description: string;
  children:
    | React.ReactNode
    | ((helpers: {
        scrollTo: (y: number) => void;
        registerRefreshHandler: (handler: (() => Promise<void>) | null) => void;
      }) => React.ReactNode);
  framed?: boolean;
  scrollable?: boolean;
  fillContent?: boolean;
  hideHeader?: boolean;
  active?: boolean;
  preservedScrollY?: number;
  onScrollOffsetChange?: (y: number) => void;
}) {
  const { colors, spacing, typography } = useAppTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const [refreshHandler, setRefreshHandler] = useState<(() => Promise<void>) | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollTo = useCallback(
    (y: number) => {
      if (!scrollable) {
        return;
      }

      scrollViewRef.current?.scrollTo({
        y: Math.max(y - spacing.lg, 0),
        animated: true,
      });
    },
    [scrollable, spacing.lg],
  );
  const registerRefreshHandler = useCallback((handler: (() => Promise<void>) | null) => {
    setRefreshHandler(() => handler);
  }, []);
  const resolvedChildren =
    typeof children === 'function' ? children({ scrollTo, registerRefreshHandler }) : children;

  const handleRefresh = useCallback(async () => {
    if (!refreshHandler || isRefreshing) {
      return;
    }

    setIsRefreshing(true);

    try {
      await refreshHandler();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshHandler]);

  useEffect(() => {
    if (!scrollable || !active) {
      return;
    }

    scrollViewRef.current?.scrollTo({
      y: preservedScrollY,
      animated: false,
    });
  }, [active, preservedScrollY, scrollable]);

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
          {resolvedChildren}
        </View>
      ) : (
        <View style={{ marginTop: hideHeader ? 0 : spacing.xl, flex: fillContent ? 1 : undefined }}>{resolvedChildren}</View>
      )}
    </>
  );

  if (scrollable) {
    return (
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        refreshControl={
          refreshHandler ? (
            <RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
          ) : undefined
        }
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          onScrollOffsetChange?.(event.nativeEvent.contentOffset.y);
        }}
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
  const { toast } = useToast();
  const { width } = useWindowDimensions();
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(ROUTES.FEED);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [hasResolvedInitialSession, setHasResolvedInitialSession] = useState(false);
  const [backStack, setBackStack] = useState<RouteSnapshot[]>([]);
  const pagerRef = useRef<ScrollView>(null);
  const mapScrollOffsetRef = useRef(0);

  const currentSnapshot = useMemo<RouteSnapshot>(
    () => ({
      route: currentRoute,
      storyId: currentRoute === ROUTES.STORY_DETAIL ? activeStoryId : null,
      userId: currentRoute === ROUTES.USER_PROFILE ? activeUserId : null,
    }),
    [activeStoryId, activeUserId, currentRoute],
  );
  const [redirectTarget, setRedirectTarget] = useState<RouteSnapshot>({ route: ROUTES.PROFILE });
  const canGoBack = backStack.length > 0;
  const isMainRoute = currentRoute === ROUTES.FEED || currentRoute === ROUTES.MAP;

  const showAuthRequiredMessage = useCallback(
    (message = 'Please sign in to continue.') => {
      toast.info(message);
    },
    [toast],
  );

  useEffect(() => {
    if (!loading) {
      setHasResolvedInitialSession(true);
    }
  }, [loading]);

  const restoreSnapshot = useCallback((snapshot: RouteSnapshot) => {
    setCurrentRoute(snapshot.route);
    setActiveStoryId(snapshot.route === ROUTES.STORY_DETAIL ? snapshot.storyId ?? null : null);
    setActiveUserId(snapshot.route === ROUTES.USER_PROFILE ? snapshot.userId ?? null : null);
  }, []);

  const navigateToSnapshot = useCallback(
    (snapshot: RouteSnapshot, options?: { resetStack?: boolean; preserveCurrent?: boolean }) => {
      if (
        !options?.resetStack &&
        snapshot.route === currentSnapshot.route &&
        snapshot.storyId === currentSnapshot.storyId &&
        snapshot.userId === currentSnapshot.userId
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
            previous?.storyId === currentSnapshot.storyId &&
            previous?.userId === currentSnapshot.userId
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
      showAuthRequiredMessage(
        route === ROUTES.PROFILE
          ? 'Please sign in to view your profile.'
          : 'Please sign in to submit a story.',
      );
      return;
    }

    navigateToSnapshot({ route });
  };

  useEffect(() => {
    if (!isMainRoute) {
      return;
    }

    const pageIndex = currentRoute === ROUTES.MAP ? 0 : 1;
    pagerRef.current?.scrollTo({ x: pageIndex * width, animated: false });
  }, [currentRoute, isMainRoute, width]);

  const handleLoginComplete = () => {
    setBackStack((current) => {
      const nextStack = [...current];
      const previousSnapshot = nextStack[nextStack.length - 1];

      if (
        previousSnapshot?.route === redirectTarget.route &&
        previousSnapshot?.storyId === redirectTarget.storyId &&
        previousSnapshot?.userId === redirectTarget.userId
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

  const handleOpenUserProfile = (userId: string) => {
    navigateToSnapshot({ route: ROUTES.USER_PROFILE, userId });
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
          framed={false}
          fillContent
        >
          <ProfileScreen mode="self" />
        </ScreenShell>
      </ProtectedScreen>
    );
  } else if (currentRoute === ROUTES.USER_PROFILE && activeUserId) {
    content = (
      <ScreenShell
        title="User profile"
        description="Public profile details."
        framed={false}
        fillContent
      >
        <ProfileScreen mode="public" userId={activeUserId} />
      </ScreenShell>
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
          description="Authenticated submission flow is ready for future form work."
        >
          <SubmissionScreen />
        </ScreenShell>
      </ProtectedScreen>
    );
  } else if (currentRoute === ROUTES.STORY_DETAIL && activeStoryId) {
    content = (
      <StoryScreen
        storyId={activeStoryId}
        session={user ? { role: user.role, user } : undefined}
        onRequestLogin={() => showAuthRequiredMessage('Please sign in to like stories and join the discussion.')}
        onGoBack={handleBack}
        onOpenContributorProfile={handleOpenUserProfile}
      />
    );
  } else {
    content = (
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => {
            const offsetX = event.nativeEvent.contentOffset.x;
            const nextRoute = offsetX < width / 2 ? ROUTES.MAP : ROUTES.FEED;

            if (nextRoute !== currentRoute) {
              setCurrentRoute(nextRoute);
            }
          }}
        >
          <View style={{ width, flex: 1 }}>
            <ScreenShell
              title="Story map"
              description="Explore stories by place."
              framed={false}
              scrollable
              hideHeader
              active={currentRoute === ROUTES.MAP}
              preservedScrollY={mapScrollOffsetRef.current}
              onScrollOffsetChange={(y) => {
                mapScrollOffsetRef.current = y;
              }}
            >
              {({ scrollTo, registerRefreshHandler }) => (
                <MapScreen
                  onOpenStory={handleOpenStoryDetail}
                  onMarkerPreviewRequested={(targetY) => scrollTo(targetY)}
                  showSearchControls={false}
                  onRegisterRefresh={registerRefreshHandler}
                />
              )}
            </ScreenShell>
          </View>
          <View style={{ width, flex: 1 }}>
            <ScreenShell
              title="Story feed"
              description="Explore local history stories."
              framed={false}
              fillContent
              hideHeader
            >
              <FeedScreen onOpenStory={handleOpenStoryDetail} showSearchControls={false} />
            </ScreenShell>
          </View>
        </ScrollView>
      </View>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          {canGoBack ? (
            <BackButton onPress={handleBack} />
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
                Local History
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Story map and feed</Text>
            </View>
          )}
          {isAuthenticated ? (
            <TopIconButton label={currentRoute === ROUTES.PROFILE ? 'You' : 'Profile'} onPress={() => handleNavigate(ROUTES.PROFILE)} />
          ) : (
            <TopIconButton label="Login" onPress={() => handleNavigate(ROUTES.AUTH)} />
          )}
        </View>
        {isMainRoute ? <StorySearchControls hideHeading /> : null}
      </View>
      <View style={{ flex: 1, backgroundColor: colors.background }}>{content}</View>
      {isMainRoute ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.lg,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <BottomNavButton label="Map" active={currentRoute === ROUTES.MAP} onPress={() => handleNavigate(ROUTES.MAP)} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submission"
            onPress={() => handleNavigate(ROUTES.SUBMISSION)}
            style={({ pressed }) => ({
              width: 58,
              height: 58,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary,
              marginHorizontal: spacing.md,
              transform: [{ translateY: -18 }],
              shadowColor: '#000000',
              shadowOpacity: 0.14,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Text style={{ color: colors.background, fontSize: 28, fontWeight: '400', marginTop: -2 }}>+</Text>
          </Pressable>
          <BottomNavButton label="Feed" active={currentRoute === ROUTES.FEED} onPress={() => handleNavigate(ROUTES.FEED)} />
        </View>
      ) : null}
    </Screen>
  );
}
