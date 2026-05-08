import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, NativeScrollEvent, NativeSyntheticEvent, Pressable, RefreshControl, ScrollView, StatusBar, Text, useWindowDimensions, View } from 'react-native';
import { Bell, MapPin, Plus } from 'lucide-react-native';
import { Loader, Screen } from '../../shared';
import { ROUTES } from './routes';
import { AuthScreen, useAuth, VerifyEmailScreen } from '../../features/auth';
import { useAppTheme } from '../../core/hooks/useAppTheme';
import { ProtectedScreen } from './ProtectedScreen';
import { FeedScreen, FeedStoryInteractionUpdate } from '../../features/feed';
import { FeedSortOption } from '../../features/feed/domain/entities';
import { ProfileCompletionScreen, ProfileScreen } from '../../features/profile';
import { SubmissionScreen } from '../../features/submissions';
import { navigationRef } from './navigationRef';
import { MapScreen } from '../../features/map';
import { StoryScreen } from '../../features/stories';
import { TimelineScreen } from '../../features/timeline';
import { StorySearchControls } from '../../features/search/presentation/components/StorySearchControls';
import { useSearchFilters } from '../../features/search/presentation/context/SearchFiltersContext';
import { useToast } from '../../shared/hooks/useToast';
import { APP_NAME } from '../../core/constants/app';
import { NotificationScreen, notificationService } from '../../features/notifications';
import { NotificationEntity } from '../../features/notifications/domain/entities';
import { ModerationScreen } from '../../features/moderation';

type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
interface RouteSnapshot {
  route: AppRoute;
  storyId?: string | null;
  commentId?: string | null;
  userId?: string | null;
}

const protectedRoutes: AppRoute[] = [ROUTES.PROFILE, ROUTES.SUBMISSION, ROUTES.NOTIFICATIONS, ROUTES.ADMIN_HOME];
const NOTIFICATION_REFRESH_INTERVAL_MS = 45000;
const MAIN_PAGER_ROUTES: AppRoute[] = [ROUTES.MAP, ROUTES.TIMELINE, ROUTES.FEED];

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

function NotificationBellButton({
  unreadCount,
  onPress,
}: {
  unreadCount: number;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useAppTheme();
  const visibleCount = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <Bell color={colors.text} size={21} strokeWidth={2.25} />
      {unreadCount > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -3,
            right: -5,
            minWidth: 20,
            height: 20,
            paddingHorizontal: spacing.xs,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.danger,
            borderWidth: 2,
            borderColor: colors.background,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: typography.caption - 1, fontWeight: '800' }}>
            {visibleCount}
          </Text>
        </View>
      ) : null}
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
      accessibilityState={{ selected: active }}
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
  flushBottom = false,
  active = false,
  disableScrollViewPanResponder = false,
  scrollEnabled = true,
  canCancelContentTouches = true,
  refreshEnabled = true,
  refreshSuppressed = false,
  testID,
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
  flushBottom?: boolean;
  active?: boolean;
  disableScrollViewPanResponder?: boolean;
  scrollEnabled?: boolean;
  canCancelContentTouches?: boolean;
  refreshEnabled?: boolean;
  refreshSuppressed?: boolean;
  testID?: string;
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
    if (!refreshHandler || isRefreshing || refreshSuppressed) {
      return;
    }

    setIsRefreshing(true);

    try {
      await refreshHandler();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshHandler, refreshSuppressed]);

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
        testID={testID}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: flushBottom ? 0 : spacing.xl }}
        showsVerticalScrollIndicator={false}
        disableScrollViewPanResponder={disableScrollViewPanResponder}
        scrollEnabled={scrollEnabled && !refreshSuppressed}
        canCancelContentTouches={canCancelContentTouches}
        scrollEventThrottle={16}
        refreshControl={
          refreshEnabled && refreshHandler ? (
            <RefreshControl
              enabled={!refreshSuppressed}
              refreshing={!refreshSuppressed && isRefreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={colors.primary}
            />
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
    <View
      style={{
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: flushBottom ? 0 : spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      {innerContent}
    </View>
  );
}

export function RootNavigator() {
  const { isAuthenticated, loading, login, logout, user } = useAuth();
  const { colors, spacing } = useAppTheme();
  const { toast } = useToast();
  const { updateFilters } = useSearchFilters('main');
  const { width } = useWindowDimensions();
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(ROUTES.FEED);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState<{ email: string; password: string } | null>(null);
  const [shouldCompleteProfileAfterLogin, setShouldCompleteProfileAfterLogin] = useState(false);
  const [feedSort, setFeedSort] = useState<FeedSortOption>('recent');
  const [storyInteractionUpdates, setStoryInteractionUpdates] = useState<Record<string, FeedStoryInteractionUpdate>>({});
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isMapTouchActive, setIsMapTouchActive] = useState(false);
  const [hasResolvedInitialSession, setHasResolvedInitialSession] = useState(false);
  const [backStack, setBackStack] = useState<RouteSnapshot[]>([]);
  const pagerRef = useRef<ScrollView>(null);
  const animatedPagerRouteRef = useRef<AppRoute | null>(null);
  const isPagerDragActiveRef = useRef(false);
  const pagerDragResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapScrollOffsetRef = useRef(0);

  const currentSnapshot = useMemo<RouteSnapshot>(
    () => ({
      route: currentRoute,
      storyId: currentRoute === ROUTES.STORY_DETAIL ? activeStoryId : null,
      commentId: currentRoute === ROUTES.STORY_DETAIL ? focusedCommentId : null,
      userId: currentRoute === ROUTES.USER_PROFILE ? activeUserId : null,
    }),
    [activeStoryId, activeUserId, currentRoute, focusedCommentId],
  );
  const [redirectTarget, setRedirectTarget] = useState<RouteSnapshot>({ route: ROUTES.PROFILE });
  const canGoBack = backStack.length > 0;
  const isMainRoute = MAIN_PAGER_ROUTES.includes(currentRoute);
  const isProfileCompletionRoute = currentRoute === ROUTES.PROFILE_COMPLETION;
  const resolvedRedirectTarget = useMemo<RouteSnapshot>(() => {
    if (redirectTarget.route === ROUTES.AUTH || redirectTarget.route === ROUTES.PROFILE_COMPLETION) {
      return { route: ROUTES.FEED };
    }

    return redirectTarget;
  }, [redirectTarget]);

  const showAuthRequiredMessage = useCallback(
    (message = 'Please sign in to continue.') => {
      toast.info(message);
    },
    [toast],
  );

  const clearPagerDragState = useCallback(() => {
    isPagerDragActiveRef.current = false;
    if (pagerDragResetTimerRef.current) {
      clearTimeout(pagerDragResetTimerRef.current);
      pagerDragResetTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      setHasResolvedInitialSession(true);
    }
  }, [loading]);

  const restoreSnapshot = useCallback((snapshot: RouteSnapshot) => {
    setCurrentRoute(snapshot.route);
    setActiveStoryId(snapshot.route === ROUTES.STORY_DETAIL ? snapshot.storyId ?? null : null);
    setFocusedCommentId(snapshot.route === ROUTES.STORY_DETAIL ? snapshot.commentId ?? null : null);
    setActiveUserId(snapshot.route === ROUTES.USER_PROFILE ? snapshot.userId ?? null : null);
  }, []);

  const scrollMainPagerToRoute = useCallback(
    (route: AppRoute, options?: { animated?: boolean }) => {
      const pageIndex = MAIN_PAGER_ROUTES.indexOf(route);

      if (pageIndex < 0) {
        return;
      }

      clearPagerDragState();
      const x = pageIndex * width;
      const animated = Boolean(options?.animated);

      if (animated) {
        animatedPagerRouteRef.current = route;
        pagerRef.current?.scrollTo({ x, y: 0, animated: true });
        return;
      }

      animatedPagerRouteRef.current = null;
      pagerRef.current?.scrollTo({ x, y: 0, animated: false });
      requestAnimationFrame(() => {
        pagerRef.current?.scrollTo({ x, y: 0, animated: false });
      });
    },
    [clearPagerDragState, width],
  );

  const navigateToSnapshot = useCallback(
    (snapshot: RouteSnapshot, options?: { resetStack?: boolean; preserveCurrent?: boolean }) => {
      if (
        !options?.resetStack &&
        snapshot.route === currentSnapshot.route &&
        snapshot.storyId === currentSnapshot.storyId &&
        snapshot.commentId === currentSnapshot.commentId &&
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
            previous?.commentId === currentSnapshot.commentId &&
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
    navigationRef.navigateToUserProfile = (targetUserId) => {
      if (user && String(user.id) === targetUserId) {
        navigateToSnapshot({ route: ROUTES.PROFILE });
        return;
      }

      navigateToSnapshot({ route: ROUTES.USER_PROFILE, userId: targetUserId });
    };

    return () => {
      navigationRef.redirectToAuth = undefined;
      navigationRef.redirectToPublic = undefined;
      navigationRef.navigate = undefined;
      navigationRef.navigateToUserProfile = undefined;
    };
  }, [currentSnapshot, navigateToSnapshot, user]);

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
    if (MAIN_PAGER_ROUTES.includes(route)) {
      scrollMainPagerToRoute(route);
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
          : route === ROUTES.ADMIN_HOME
            ? 'Please sign in with an admin account to continue.'
            : 'Please sign in to submit a story.',
      );
      return;
    }

    navigateToSnapshot({ route });
  };

  useEffect(() => {
    if (!isMainRoute) {
      setIsMapTouchActive(false);
      isPagerDragActiveRef.current = false;
      if (pagerDragResetTimerRef.current) {
        clearTimeout(pagerDragResetTimerRef.current);
        pagerDragResetTimerRef.current = null;
      }
      return;
    }

    if (currentRoute !== ROUTES.MAP) {
      setIsMapTouchActive(false);
    }

    const pageIndex = Math.max(MAIN_PAGER_ROUTES.indexOf(currentRoute), 0);
    if (animatedPagerRouteRef.current === MAIN_PAGER_ROUTES[pageIndex]) {
      animatedPagerRouteRef.current = null;
      return;
    }

    scrollMainPagerToRoute(MAIN_PAGER_ROUTES[pageIndex]);
  }, [currentRoute, isMainRoute, scrollMainPagerToRoute]);

  useEffect(
    () => () => {
      if (pagerDragResetTimerRef.current) {
        clearTimeout(pagerDragResetTimerRef.current);
      }
    },
    [],
  );

  const handleLoginComplete = (context?: { source: 'signIn' | 'register' }) => {
    if (shouldCompleteProfileAfterLogin) {
      setShouldCompleteProfileAfterLogin(false);
      navigateToSnapshot(
        { route: ROUTES.PROFILE_COMPLETION },
        { resetStack: true, preserveCurrent: false },
      );
      return;
    }

    if (context?.source === 'register') {
      navigateToSnapshot(
        { route: ROUTES.PROFILE_COMPLETION },
        { resetStack: true, preserveCurrent: false },
      );
      return;
    }

    setBackStack((current) => {
      const nextStack = [...current];
      const previousSnapshot = nextStack[nextStack.length - 1];

      if (
        previousSnapshot?.route === resolvedRedirectTarget.route &&
        previousSnapshot?.storyId === resolvedRedirectTarget.storyId &&
        previousSnapshot?.commentId === resolvedRedirectTarget.commentId &&
        previousSnapshot?.userId === resolvedRedirectTarget.userId
      ) {
        nextStack.pop();
      }

      return nextStack;
    });
    restoreSnapshot(resolvedRedirectTarget);
  };

  const handleRegistrationPending = useCallback(
    (context: { email: string; password: string }) => {
      setPendingVerification(context);
      navigateToSnapshot({ route: ROUTES.VERIFY_EMAIL }, { resetStack: true, preserveCurrent: false });
    },
    [navigateToSnapshot],
  );

  const handleVerificationSuccess = useCallback(async () => {
    const credentials = pendingVerification;
    setPendingVerification(null);

    if (credentials) {
      try {
        await login({ email: credentials.email, password: credentials.password });
        toast.success('Account verified! Welcome!');
        navigateToSnapshot(
          { route: ROUTES.PROFILE_COMPLETION },
          { resetStack: true, preserveCurrent: false },
        );
        return;
      } catch {
        // Fall back to manual login if the temporary credentials cannot be reused.
      }
    }

    setShouldCompleteProfileAfterLogin(true);
    toast.success('Account verified! You can now log in.');
    navigateToSnapshot({ route: ROUTES.AUTH }, { resetStack: true, preserveCurrent: false });
  }, [login, navigateToSnapshot, pendingVerification, toast]);

  const handleProfileCompletionComplete = useCallback(() => {
    navigateToSnapshot(resolvedRedirectTarget, { resetStack: true, preserveCurrent: false });
  }, [navigateToSnapshot, resolvedRedirectTarget]);

  useEffect(() => {
    if (!isAuthenticated || currentRoute !== ROUTES.AUTH) {
      return;
    }

    restoreSnapshot(resolvedRedirectTarget);
  }, [currentRoute, isAuthenticated, resolvedRedirectTarget, restoreSnapshot]);

  const syncNotificationBadge = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadNotificationCount(0);
      return;
    }

    try {
      const notifications = await notificationService.getNotifications(1);
      setUnreadNotificationCount(notifications.filter((notification) => !notification.isRead).length);
    } catch {
      // Keep the last visible badge count; notification screen surfaces load failures directly.
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadNotificationCount(0);
      return;
    }

    void syncNotificationBadge();
    const intervalId = setInterval(() => {
      void syncNotificationBadge();
    }, NOTIFICATION_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, syncNotificationBadge]);

  const handleLogout = async () => {
    await logout();
  };

  const handleOpenStoryDetail = (storyId: string) => {
    navigateToSnapshot({ route: ROUTES.STORY_DETAIL, storyId });
  };

  const handleOpenStoryComment = (storyId: string, commentId: string) => {
    navigateToSnapshot({ route: ROUTES.STORY_DETAIL, storyId, commentId });
  };

  const handleViewTimelineNearPin = useCallback(
    (target: { latitude: number; longitude: number; label?: string; storyId?: string }) => {
      updateFilters(
        {
          query: '',
          location: '',
          locationBounds: undefined,
          proximityRadiusKm: 0.5,
          proximityCoordinates: {
            latitude: target.latitude,
            longitude: target.longitude,
          },
          proximitySource: 'map_pin',
          proximityLabel: target.label,
          proximityStoryId: target.storyId,
          timeFrom: '',
          timeTo: '',
          tags: [],
        },
        { refresh: true },
      );
      scrollMainPagerToRoute(ROUTES.TIMELINE);
      navigateToSnapshot({ route: ROUTES.TIMELINE }, { resetStack: true, preserveCurrent: false });
    },
    [navigateToSnapshot, scrollMainPagerToRoute, updateFilters],
  );

  const handleNotificationsChanged = useCallback((notifications: NotificationEntity[]) => {
    setUnreadNotificationCount(notifications.filter((notification) => !notification.isRead).length);
  }, []);

  const handleStoryInteractionUpdated = useCallback(
    (update: { storyId: string } & FeedStoryInteractionUpdate) => {
      setStoryInteractionUpdates((current) => ({
        ...current,
        [update.storyId]: {
          ...current[update.storyId],
          likeCount: update.likeCount ?? current[update.storyId]?.likeCount,
          likedByViewer: update.likedByViewer ?? current[update.storyId]?.likedByViewer,
          savedByViewer: update.savedByViewer ?? current[update.storyId]?.savedByViewer,
        },
      }));
    },
    [],
  );

  const handleOpenUserProfile = (userId: string) => {
    if (user && String(user.id) === userId) {
      navigateToSnapshot({ route: ROUTES.PROFILE });
      return;
    }

    navigateToSnapshot({ route: ROUTES.USER_PROFILE, userId });
  };

  const handleOpenTag = useCallback(
    (tag: string) => {
      updateFilters(
        {
          query: '',
          location: '',
          locationBounds: undefined,
          proximityRadiusKm: undefined,
          proximityCoordinates: undefined,
          proximitySource: undefined,
          timeFrom: '',
          timeTo: '',
          tags: [tag],
        },
        { refresh: true },
      );
      navigateToSnapshot({ route: ROUTES.FEED }, { resetStack: true, preserveCurrent: false });
    },
    [navigateToSnapshot, updateFilters],
  );

  if (!hasResolvedInitialSession && loading) {
    return (
      <Screen>
        <StatusBar barStyle="dark-content" />
        <Loader fullScreen message="Restoring session..." />
      </Screen>
    );
  }

  if (isProfileCompletionRoute) {
    return (
      <Screen>
        <StatusBar barStyle="dark-content" />
        <ProfileCompletionScreen onCompleted={handleProfileCompletionComplete} />
      </Screen>
    );
  }

  let content: React.ReactNode;

  if (currentRoute === ROUTES.AUTH) {
    content = <AuthScreen onAuthenticated={handleLoginComplete} onRegistrationPending={handleRegistrationPending} />;
  } else if (currentRoute === ROUTES.VERIFY_EMAIL && pendingVerification) {
    content = (
      <VerifyEmailScreen
        email={pendingVerification.email}
        onVerified={handleVerificationSuccess}
        onRegisterAgain={() => {
          setPendingVerification(null);
          navigateToSnapshot({ route: ROUTES.AUTH }, { resetStack: true, preserveCurrent: false });
        }}
      />
    );
  } else if (currentRoute === ROUTES.PROFILE) {
    content = (
      <ProtectedScreen
        title="Profile requires sign-in"
        description="Sign in to view your profile."
        onAuthenticated={handleLoginComplete}
        onRegistrationPending={handleRegistrationPending}
      >
        <ScreenShell
          title="Your profile"
          description={user?.username ? `Signed in as ${user.username}.` : 'Your account details.'}
          framed={false}
          fillContent
        >
          <ProfileScreen
            mode="self"
            onOpenStory={handleOpenStoryDetail}
            onStoryInteractionUpdated={handleStoryInteractionUpdated}
          />
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
        <ProfileScreen
          mode="public"
          userId={activeUserId}
          onOpenUserProfile={(targetUserId) => navigationRef.navigateToUserProfile?.(targetUserId)}
        />
      </ScreenShell>
    );
  } else if (currentRoute === ROUTES.SUBMISSION) {
    content = (
      <ProtectedScreen
        title="Submission requires sign-in"
        description="Sign in to submit a story."
        onAuthenticated={handleLoginComplete}
        onRegistrationPending={handleRegistrationPending}
      >
        <ScreenShell
          title="Submit a story"
          description="Authenticated submission flow is ready for future form work."
        >
          <SubmissionScreen />
        </ScreenShell>
      </ProtectedScreen>
    );
  } else if (currentRoute === ROUTES.NOTIFICATIONS) {
    content = (
      <ProtectedScreen
        title="Notifications require sign-in"
        description="Sign in to view notifications."
        onAuthenticated={handleLoginComplete}
        onRegistrationPending={handleRegistrationPending}
      >
        <ScreenShell
          title="Notifications"
          description="Recent activity and account updates."
          framed={false}
          fillContent
        >
          <NotificationScreen
            onOpenStory={handleOpenStoryDetail}
            onOpenProfile={() => navigateToSnapshot({ route: ROUTES.PROFILE })}
            onNotificationsChanged={handleNotificationsChanged}
          />
        </ScreenShell>
      </ProtectedScreen>
    );
  } else if (currentRoute === ROUTES.ADMIN_HOME) {
    content = (
      <ProtectedScreen
        title="Admin tools require sign-in"
        description="Sign in with an admin account to continue."
        onAuthenticated={handleLoginComplete}
        onRegistrationPending={handleRegistrationPending}
      >
        <ScreenShell
          title="Admin moderation"
          description="Review reports, stories, and tags."
          framed={false}
          fillContent
          hideHeader
          flushBottom
        >
          <ModerationScreen onOpenStory={handleOpenStoryDetail} onOpenComment={handleOpenStoryComment} />
        </ScreenShell>
      </ProtectedScreen>
    );
  } else if (currentRoute === ROUTES.STORY_DETAIL && activeStoryId) {
    content = (
      <StoryScreen
        storyId={activeStoryId}
        focusedCommentId={focusedCommentId ?? undefined}
        session={user ? { role: user.role, user } : undefined}
        onRequestLogin={() => showAuthRequiredMessage('Please sign in to like stories and join the discussion.')}
        onGoBack={handleBack}
        onStoryDeleted={() => {
          toast.success('Story deleted.');
          navigateToSnapshot({ route: ROUTES.FEED }, { resetStack: true, preserveCurrent: false });
        }}
        onStoryInteractionUpdated={handleStoryInteractionUpdated}
        onOpenContributorProfile={handleOpenUserProfile}
        onOpenTag={handleOpenTag}
      />
    );
  } else {
    content = (
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={pagerRef}
          testID="main-route-pager"
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={{ flexGrow: 1 }}
          horizontal
          pagingEnabled
          canCancelContentTouches={currentRoute !== ROUTES.MAP}
          directionalLockEnabled
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          contentOffset={{ x: Math.max(MAIN_PAGER_ROUTES.indexOf(currentRoute), 0) * width, y: 0 }}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            if (pagerDragResetTimerRef.current) {
              clearTimeout(pagerDragResetTimerRef.current);
              pagerDragResetTimerRef.current = null;
            }
            isPagerDragActiveRef.current = true;
          }}
          onScrollEndDrag={() => {
            if (pagerDragResetTimerRef.current) {
              clearTimeout(pagerDragResetTimerRef.current);
            }

            pagerDragResetTimerRef.current = setTimeout(() => {
              isPagerDragActiveRef.current = false;
              pagerDragResetTimerRef.current = null;
            }, 500);
          }}
          onMomentumScrollBegin={() => {
            if (pagerDragResetTimerRef.current) {
              clearTimeout(pagerDragResetTimerRef.current);
              pagerDragResetTimerRef.current = null;
            }
          }}
          onMomentumScrollEnd={(event) => {
            if (!isPagerDragActiveRef.current) {
              return;
            }

            isPagerDragActiveRef.current = false;
            if (pagerDragResetTimerRef.current) {
              clearTimeout(pagerDragResetTimerRef.current);
              pagerDragResetTimerRef.current = null;
            }
            const offsetX = event.nativeEvent.contentOffset.x;
            const pageIndex = Math.max(0, Math.min(MAIN_PAGER_ROUTES.length - 1, Math.round(offsetX / width)));
            const nextRoute = MAIN_PAGER_ROUTES[pageIndex];

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
              refreshSuppressed={isMapTouchActive}
              testID="map-route-scroll"
              preservedScrollY={mapScrollOffsetRef.current}
              onScrollOffsetChange={(y) => {
                mapScrollOffsetRef.current = y;
              }}
            >
              {({ scrollTo, registerRefreshHandler }) => (
                <MapScreen
                  onOpenStory={handleOpenStoryDetail}
                  onViewTimeline={handleViewTimelineNearPin}
                  onMarkerPreviewRequested={(targetY) => scrollTo(targetY)}
                  showSearchControls={false}
                  onRegisterRefresh={registerRefreshHandler}
                  onMapTouchChange={setIsMapTouchActive}
                  searchScope="main"
                />
              )}
            </ScreenShell>
          </View>
          <View style={{ width, flex: 1 }}>
            <ScreenShell
              title="Timeline"
              description="Explore stories by time."
              framed={false}
              fillContent
              hideHeader
              flushBottom
            >
              <TimelineScreen
                onOpenStory={handleOpenStoryDetail}
                showSearchControls={false}
                searchScope="main"
              />
            </ScreenShell>
          </View>
          <View style={{ width, flex: 1 }}>
            <ScreenShell
              title="Story feed"
              description="Explore local history stories."
              framed={false}
              fillContent
              hideHeader
              flushBottom
            >
              <FeedScreen
                onOpenStory={handleOpenStoryDetail}
                onOpenTag={handleOpenTag}
                initialSort={feedSort}
                onSortChange={setFeedSort}
                showSearchControls={false}
                searchScope="main"
                storyInteractionUpdates={storyInteractionUpdates}
                onStoryInteractionUpdated={handleStoryInteractionUpdated}
                isAuthenticated={Boolean(isAuthenticated)}
                onRequestLogin={() => showAuthRequiredMessage('Please sign in to bookmark stories.')}
              />
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
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 }}>
              <MapPin color={colors.text} size={28} strokeWidth={2.25} />
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
                {APP_NAME}
              </Text>
            </View>
          )}
          {isAuthenticated ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {user?.role === 'admin' ? (
                <TopIconButton
                  label="Admin"
                  filled={currentRoute === ROUTES.ADMIN_HOME}
                  onPress={() => handleNavigate(ROUTES.ADMIN_HOME)}
                />
              ) : null}
              <NotificationBellButton
                unreadCount={unreadNotificationCount}
                onPress={() => handleNavigate(ROUTES.NOTIFICATIONS)}
              />
              <TopIconButton label={currentRoute === ROUTES.PROFILE ? 'You' : 'Profile'} onPress={() => handleNavigate(ROUTES.PROFILE)} />
            </View>
          ) : (
            <TopIconButton label="Login" onPress={() => handleNavigate(ROUTES.AUTH)} />
          )}
        </View>
      {isMainRoute ? <StorySearchControls hideHeading scope="main" /> : null}
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
          <BottomNavButton label="Timeline" active={currentRoute === ROUTES.TIMELINE} onPress={() => handleNavigate(ROUTES.TIMELINE)} />
          <BottomNavButton label="Feed" active={currentRoute === ROUTES.FEED} onPress={() => handleNavigate(ROUTES.FEED)} />
        </View>
      ) : null}
      {isMainRoute ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Submission"
          onPress={() => handleNavigate(ROUTES.SUBMISSION)}
          style={({ pressed }) => ({
            position: 'absolute',
            right: spacing.lg,
            bottom: spacing.lg + 62,
            width: 56,
            height: 56,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            shadowColor: '#000000',
            shadowOpacity: 0.16,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <Plus color={colors.background} size={27} strokeWidth={2.5} />
        </Pressable>
      ) : null}
    </Screen>
  );
}
