import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { GestureResponderEvent } from 'react-native';
import { navigationRef } from '../../../../app/navigation/navigationRef';
import { ROUTES } from '../../../../app/navigation/routes';
import { limits } from '../../../../core/constants/limits';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Button, EmptyState, ErrorState, Input, Loader, Skeleton } from '../../../../shared';
import { useToast } from '../../../../shared/hooks/useToast';
import { authService } from '../../../auth/application/services';
import { useAuth } from '../../../auth';
import { interactionService } from '../../../interactions/application/services';
import { FeedCard } from '../../../feed/presentation/components/FeedCard';
import { FeedEntity, FeedPageEntity } from '../../../feed/domain/entities';
import { userService } from '../../application/services';
import { FollowListResult, FollowUserEntity, ProfileEntity, ProfilePhotoUploadInput, UpdateProfileInput } from '../../domain/entities';
import { AuthUser } from '../../../../core/auth/session';

type ProfileMode = 'self' | 'public';
type SelfProfileTab = 'profile' | 'saved';

const BIO_MAX_LENGTH = 280;
const MIN_BIRTH_YEAR = 1900;
const FOLLOW_STATE_LOOKUP_MAX_PAGES = 10;
const FOLLOW_LIST_DRAG_THRESHOLD = 8;
const followStateOverrides = new Map<string, boolean>();
const MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

interface ProfileScreenProps {
  mode?: ProfileMode;
  userId?: string;
  getCurrentProfile?: typeof userService.getCurrentProfile;
  getPublicProfile?: typeof userService.getPublicProfile;
  updateCurrentProfile?: typeof userService.updateProfile;
  uploadProfilePhoto?: typeof userService.uploadProfilePhoto;
  removeProfilePhoto?: typeof userService.removeProfilePhoto;
  deleteAccount?: typeof userService.deleteAccount;
  followUser?: typeof userService.followUser;
  unfollowUser?: typeof userService.unfollowUser;
  getFollowers?: typeof userService.getFollowers;
  getFollowing?: typeof userService.getFollowing;
  getSavedStories?: typeof userService.getSavedStories;
  unbookmarkStory?: typeof interactionService.unbookmarkStory;
  onOpenUserProfile?: (userId: string) => void;
  onOpenStory?: (storyId: string) => void;
  onStoryInteractionUpdated?: (update: { storyId: string; savedByViewer?: boolean; likeCount?: number }) => void;
}

interface ProfileFormState {
  firstName: string;
  lastName: string;
  username: string;
  bio: string;
  location: string;
  birthDate: string;
  isNamePublic: boolean;
  isUsernamePublic: boolean;
  isBioPublic: boolean;
  isLocationPublic: boolean;
  isBirthDatePublic: boolean;
  isPhotoPublic: boolean;
}

interface FormErrors {
  birthDate?: string;
  bio?: string;
  photo?: string;
}

interface PendingPhotoState extends ProfilePhotoUploadInput {
  fileSize: number;
  previewUri: string;
}

type FollowListDisplayUser = FollowUserEntity & {
  isCurrentUser?: boolean;
};

function getFollowStateOverrideKey(currentUserId: string | number | undefined, targetUserId: string) {
  if (currentUserId === undefined) {
    return null;
  }

  return `${String(currentUserId)}:${targetUserId}`;
}

async function inferFollowStateFromFollowers({
  targetUserId,
  currentUserId,
  getFollowers,
}: {
  targetUserId: string;
  currentUserId: string;
  getFollowers: (userId: string, page?: number) => Promise<FollowListResult>;
}) {
  let page = 1;

  while (page <= FOLLOW_STATE_LOOKUP_MAX_PAGES) {
    const result = await getFollowers(targetUserId, page);

    if (result.users.some((followUser) => followUser.id === currentUserId)) {
      return true;
    }

    if (!result.next) {
      return false;
    }

    page += 1;
  }

  return undefined;
}

function formatJoinedDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return undefined;
  }

  return parsedDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function formatBirthDateLabel(value: string) {
  const parsedDate = parseBirthDate(value);

  if (!parsedDate) {
    return 'Choose birth date';
  }

  return parsedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatProfileBirthDate(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const parsedDate = parseBirthDate(value);

  if (!parsedDate) {
    return undefined;
  }

  return parsedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map((part) => Number(part));
  const parsedDate = new Date(Date.UTC(year, month - 1, day, 12));

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  return parsedDate;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampDayInput(value: string, maxDay: number) {
  const digitsOnly = value.replace(/[^0-9]/g, '').slice(0, 2);

  if (!digitsOnly) {
    return '';
  }

  const parsedDay = Number.parseInt(digitsOnly, 10);

  if (!Number.isFinite(parsedDay)) {
    return '';
  }

  return String(Math.min(Math.max(parsedDay, 1), maxDay));
}

function clampBirthDateParts(
  yearValue: string,
  monthIndex: number,
  dayValue: string,
) {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonthIndex = today.getMonth();
  const todayDay = today.getDate();

  const parsedYear = Number.parseInt(yearValue.replace(/[^0-9]/g, '').slice(0, 4), 10);
  const safeYear = Number.isFinite(parsedYear) ? Math.max(parsedYear, MIN_BIRTH_YEAR) : todayYear;
  const maxDayForMonth = daysInMonth(safeYear, monthIndex);
  const parsedDay = Number.parseInt(dayValue.replace(/[^0-9]/g, '').slice(0, 2), 10);
  const safeDay = Number.isFinite(parsedDay) ? Math.min(Math.max(parsedDay, 1), maxDayForMonth) : 1;

  const candidate = new Date(safeYear, monthIndex, safeDay);

  if (candidate.getTime() <= today.getTime()) {
    return {
      year: String(safeYear),
      monthIndex,
      day: String(safeDay),
    };
  }

  return {
    year: String(todayYear),
    monthIndex: todayMonthIndex,
    day: String(todayDay),
  };
}

function getDraftMaxBirthDay(yearValue: string, monthIndex: number) {
  const parsedYear = Number.parseInt(yearValue.replace(/[^0-9]/g, '').slice(0, 4), 10);

  if (!Number.isFinite(parsedYear)) {
    return 31;
  }

  return daysInMonth(Math.max(parsedYear, MIN_BIRTH_YEAR), monthIndex);
}

function createFormState(profile?: ProfileEntity | null): ProfileFormState {
  return {
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    username: profile?.username ?? '',
    bio: profile?.bio ?? '',
    location: profile?.location ?? '',
    birthDate: profile?.birthDate ?? '',
    isNamePublic: profile?.isNamePublic ?? true,
    isUsernamePublic: profile?.isUsernamePublic ?? true,
    isBioPublic: true,
    isLocationPublic: profile?.isLocationPublic ?? true,
    isBirthDatePublic: profile?.isBirthDatePublic ?? true,
    isPhotoPublic: profile?.isPhotoPublic ?? true,
  };
}

function areFormStatesEqual(left: ProfileFormState, right: ProfileFormState) {
  return (
    left.firstName === right.firstName &&
    left.lastName === right.lastName &&
    left.username === right.username &&
    left.bio === right.bio &&
    left.location === right.location &&
    left.birthDate === right.birthDate &&
    left.isNamePublic === right.isNamePublic &&
    left.isUsernamePublic === right.isUsernamePublic &&
    left.isBioPublic === right.isBioPublic &&
    left.isLocationPublic === right.isLocationPublic &&
    left.isBirthDatePublic === right.isBirthDatePublic &&
    left.isPhotoPublic === right.isPhotoPublic
  );
}

function validateBirthDate(value: string) {
  if (!value) {
    return undefined;
  }

  const parsedDate = parseBirthDate(value);

  if (!parsedDate) {
    return 'Choose a valid birth date.';
  }

  if (parsedDate.getFullYear() < MIN_BIRTH_YEAR) {
    return `Birth date must be after ${MIN_BIRTH_YEAR}.`;
  }

  const now = new Date();

  if (parsedDate.getTime() > now.getTime()) {
    return 'Birth date cannot be in the future.';
  }

  return undefined;
}

function resolveMimeType(fileName?: string | null, mimeType?: string | null) {
  if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
    return mimeType;
  }

  const lowerFileName = fileName?.toLowerCase() ?? '';

  if (lowerFileName.endsWith('.jpg') || lowerFileName.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (lowerFileName.endsWith('.png')) {
    return 'image/png';
  }

  return null;
}

function validatePendingPhoto(photo: PendingPhotoState | null) {
  if (!photo) {
    return undefined;
  }

  if (photo.fileSize > limits.maxProfilePhotoMb * 1024 * 1024) {
    return `Photo must be ${limits.maxProfilePhotoMb} MB or smaller.`;
  }

  if (photo.mimeType !== 'image/jpeg' && photo.mimeType !== 'image/png') {
    return 'Profile photo must be a JPG or PNG image.';
  }

  return undefined;
}

function LoadingState() {
  const { colors, spacing } = useAppTheme();

  return (
    <View accessibilityLabel="Loading profile" style={{ flex: 1, gap: spacing.md }}>
      <View
        style={{
          padding: spacing.lg,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          gap: spacing.md,
        }}
      >
        <Skeleton width="50%" height={26} />
        <Skeleton width="65%" />
        <Skeleton width="42%" />
        <Skeleton width="100%" height={72} />
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  disabled = false,
  onToggle,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onToggle?: () => void;
}) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
      }}
    >
      <Text style={{ flex: 1, color: colors.text, fontSize: typography.body }}>{label}</Text>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        disabled={disabled}
        onPress={disabled ? undefined : onToggle}
        style={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: value ? colors.primary : colors.border,
          backgroundColor: value ? colors.infoSurface : colors.surface,
        }}
      >
        <Text style={{ color: value ? colors.primary : colors.text, fontWeight: '700' }}>
          {value ? 'Public' : 'Private'}
        </Text>
      </Pressable>
    </View>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        minWidth: 120,
        padding: spacing.md,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        gap: spacing.xs,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: typography.caption, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}

function StatButton({
  label,
  value,
  onPress,
  accessibilityLabel,
  selected = false,
}: {
  label: string;
  value: string;
  onPress: () => void;
  accessibilityLabel?: string;
  selected?: boolean;
}) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${value} ${label}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 120,
        padding: spacing.md,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.infoSurface : colors.background,
        gap: spacing.xs,
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <Text style={{ color: selected ? colors.primary : colors.muted, fontSize: typography.caption, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text style={{ color: selected ? colors.primary : colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>{value}</Text>
    </Pressable>
  );
}

function FollowActionButton({
  isAuthenticated,
  isFollowing,
  isLoading,
  onToggle,
  onRequestLogin,
}: {
  isAuthenticated: boolean;
  isFollowing: boolean;
  isLoading: boolean;
  onToggle: () => void;
  onRequestLogin: () => void;
}) {
  if (!isAuthenticated) {
    return (
      <Button variant="outline" onPress={onRequestLogin} accessibilityLabel="Log in to follow this user">
        Log in to follow
      </Button>
    );
  }

  return (
    <Button
      variant={isFollowing ? 'outline' : 'primary'}
      onPress={onToggle}
      disabled={isLoading}
      accessibilityLabel={isFollowing ? 'Unfollow user' : 'Follow user'}
    >
      {isLoading ? 'Updating...' : isFollowing ? 'Following' : 'Follow'}
    </Button>
  );
}

function FollowListModal({
  visible,
  mode,
  userId,
  fetchFollowers,
  fetchFollowing,
  currentUser,
  showCurrentUserAtTop,
  onClose,
  onOpenUserProfile,
}: {
  visible: boolean;
  mode: 'followers' | 'following';
  userId: string;
  fetchFollowers: (userId: string, page?: number) => Promise<FollowListResult>;
  fetchFollowing: (userId: string, page?: number) => Promise<FollowListResult>;
  currentUser: AuthUser | null;
  showCurrentUserAtTop: boolean;
  onClose: () => void;
  onOpenUserProfile?: (userId: string) => void;
}) {
  const { colors, spacing, typography } = useAppTheme();
  const [users, setUsers] = useState<FollowUserEntity[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const rowPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const rowPressMovedRef = useRef(false);
  const isFollowersMode = mode === 'followers';
  const title = isFollowersMode ? 'Followers' : 'Following';
  const currentUserId = currentUser?.id == null ? null : String(currentUser.id);
  const shouldPinCurrentUser =
    showCurrentUserAtTop && isFollowersMode && currentUserId != null && Boolean(currentUser?.username);
  const visibleUsers = useMemo<FollowListDisplayUser[]>(() => {
    if (!shouldPinCurrentUser || !currentUserId || !currentUser) {
      return users;
    }

    return [
      {
        id: currentUserId,
        username: currentUser.username,
        profilePhoto: null,
        isCurrentUser: true,
      },
      ...users
        .filter((followUser) => followUser.id !== currentUserId)
        .map((followUser) => ({ ...followUser, isCurrentUser: false })),
    ];
  }, [currentUser, currentUserId, shouldPinCurrentUser, users]);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      setIsLoading(true);
      setError(undefined);

      try {
        const result = isFollowersMode
          ? await fetchFollowers(userId, nextPage)
          : await fetchFollowing(userId, nextPage);

        setUsers((current) => (append ? [...current, ...result.users] : result.users));
        setHasMore(Boolean(result.next));
        setPage(nextPage);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load users.');
      } finally {
        setIsLoading(false);
      }
    },
    [fetchFollowers, fetchFollowing, isFollowersMode, userId],
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    setUsers([]);
    setPage(1);
    setHasMore(false);
    void loadPage(1, false);
  }, [loadPage, mode, visible]);

  const handleRowPressIn = useCallback((event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;

    rowPressStartRef.current = { x: pageX, y: pageY };
    rowPressMovedRef.current = false;
  }, []);

  const handleRowTouchMove = useCallback((event: GestureResponderEvent) => {
    const start = rowPressStartRef.current;

    if (!start) {
      return;
    }

    const { pageX, pageY } = event.nativeEvent;
    const distance = Math.abs(pageX - start.x) + Math.abs(pageY - start.y);

    if (distance > FOLLOW_LIST_DRAG_THRESHOLD) {
      rowPressMovedRef.current = true;
    }
  }, []);

  const handleRowPress = useCallback(
    (targetUserId: string) => {
      if (rowPressMovedRef.current) {
        rowPressStartRef.current = null;
        rowPressMovedRef.current = false;
        return;
      }

      rowPressStartRef.current = null;
      onClose();
      onOpenUserProfile?.(targetUserId);
    },
    [onClose, onOpenUserProfile],
  );

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(10, 10, 10, 0.35)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            maxHeight: '82%',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xl,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: colors.background,
            gap: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <View>
              <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>{title}</Text>
              <Text style={{ marginTop: spacing.xs, color: colors.muted }}>
                {isFollowersMode ? 'People who follow this user.' : 'People this user follows.'}
              </Text>
            </View>
            <Button variant="outline" onPress={onClose}>
              Close
            </Button>
          </View>

          {isLoading && users.length === 0 ? <Loader message={`Loading ${title.toLowerCase()}...`} /> : null}
          {error && users.length === 0 ? (
            <ErrorState
              title={`${title} unavailable`}
              message={error}
              retryLabel="Try again"
              onRetry={() => {
                void loadPage(1, false);
              }}
            />
          ) : null}
          {!isLoading && !error && users.length === 0 ? (
            <Text style={{ color: colors.muted }}>
              {isFollowersMode ? 'No followers yet.' : 'Not following anyone yet.'}
            </Text>
          ) : null}

          {visibleUsers.length > 0 ? (
            <ScrollView
              style={{ maxHeight: 360, minHeight: Math.min(260, 72 * visibleUsers.length) }}
              contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}
              alwaysBounceVertical
              overScrollMode="always"
              keyboardShouldPersistTaps="handled"
            >
              {visibleUsers.map((followUser) => {
                const label = followUser.username ?? 'Anonymous user';
                const displayLabel = followUser.isCurrentUser ? `${label} (You)` : label;

                return (
                  <Pressable
                    key={followUser.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${displayLabel} profile`}
                    onPressIn={handleRowPressIn}
                    onTouchMove={handleRowTouchMove}
                    onPress={() => handleRowPress(followUser.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      padding: spacing.md,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      opacity: pressed ? 0.82 : 1,
                    })}
                  >
                    {followUser.profilePhoto ? (
                      <Image
                        source={{ uri: followUser.profilePhoto }}
                        accessibilityLabel={`${displayLabel} profile photo`}
                        style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.infoSurface }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.infoSurface,
                        }}
                      >
                        <Text style={{ color: colors.primary, fontWeight: '800' }}>
                          {label.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={{ flex: 1, color: colors.text, fontWeight: '700' }}>{displayLabel}</Text>
                  </Pressable>
                );
              })}
              {hasMore ? (
                <Button
                  variant="outline"
                  onPress={() => {
                    void loadPage(page + 1, true);
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load more'}
                </Button>
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function FieldCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        padding: spacing.md,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        gap: spacing.sm,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: typography.caption, textTransform: 'uppercase' }}>{title}</Text>
      {children}
      {footer}
    </View>
  );
}

function SavedStoriesSection({
  userId,
  getSavedStories,
  unbookmarkStory,
  onTotalCountChange,
  onOpenStory,
  onStoryInteractionUpdated,
}: {
  userId: string;
  getSavedStories: (userId: string, page?: number) => Promise<FeedPageEntity>;
  unbookmarkStory: (storyId: string) => Promise<void>;
  onTotalCountChange?: (count: number) => void;
  onOpenStory?: (storyId: string) => void;
  onStoryInteractionUpdated?: (update: { storyId: string; savedByViewer?: boolean; likeCount?: number }) => void;
}) {
  const { colors, spacing, typography } = useAppTheme();
  const { toast } = useToast();
  const [stories, setStories] = useState<FeedEntity[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const [pendingStoryId, setPendingStoryId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      setError(undefined);

      try {
        const result = await getSavedStories(userId, nextPage);
        setStories((current) => (append ? [...current, ...result.items] : result.items));
        setPage(nextPage);
        setHasMore(result.hasNextPage);
        setTotalCount(result.totalCount);
        onTotalCountChange?.(result.totalCount);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load saved stories.');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [getSavedStories, onTotalCountChange, userId],
  );

  useEffect(() => {
    setStories([]);
    setPage(1);
    setHasMore(false);
    void loadPage(1, false);
  }, [loadPage]);

  const handleRemoveBookmark = useCallback(
    async (storyId: string) => {
      if (pendingStoryId) {
        return;
      }

      const previousStories = stories;
      const previousTotalCount = totalCount;
      const nextStories = stories.filter((story) => story.id !== storyId);
      const nextTotalCount = Math.max(0, totalCount - 1);

      setPendingStoryId(storyId);
      setStories(nextStories);
      setTotalCount(nextTotalCount);
      onTotalCountChange?.(nextTotalCount);
      onStoryInteractionUpdated?.({ storyId, savedByViewer: false });

      try {
        await unbookmarkStory(storyId);
        toast.success('Removed from saved stories.');
      } catch {
        setStories(previousStories);
        setTotalCount(previousTotalCount);
        onTotalCountChange?.(previousTotalCount);
        onStoryInteractionUpdated?.({ storyId, savedByViewer: true });
        toast.error('Failed to remove saved story. Please try again.');
      } finally {
        setPendingStoryId(null);
      }
    },
    [onStoryInteractionUpdated, onTotalCountChange, pendingStoryId, stories, toast, totalCount, unbookmarkStory],
  );

  return (
    <View
      accessibilityLabel="Saved stories section"
      style={{
        padding: spacing.lg,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        gap: spacing.md,
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
          Saved Stories
        </Text>
        <Text style={{ color: colors.muted }}>
          Stories you bookmarked, ordered by most recently saved.
        </Text>
      </View>

      {isLoading && stories.length === 0 ? <Loader message="Loading saved stories..." /> : null}

      {error && stories.length === 0 ? (
        <ErrorState
          title="Saved stories unavailable"
          message={error}
          retryLabel="Try again"
          onRetry={() => {
            void loadPage(1, false);
          }}
        />
      ) : null}

      {!isLoading && !error && stories.length === 0 ? (
        <EmptyState
          title="No saved stories yet"
          message="Bookmark stories to find them here later."
          actionLabel="Browse stories"
          onAction={() => navigationRef.navigate?.(ROUTES.FEED)}
        />
      ) : null}

      {stories.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          {stories.map((story) => (
            <FeedCard
              key={story.id}
              story={{ ...story, savedByViewer: true }}
              bookmarkAccessibilityLabel={`Remove ${story.title} from saved stories`}
              isBookmarkPending={pendingStoryId === story.id}
              onPress={onOpenStory}
              onBookmarkPress={(storyId) => {
                void handleRemoveBookmark(storyId);
              }}
            />
          ))}
          {hasMore ? (
            <Button
              variant="outline"
              onPress={() => {
                void loadPage(page + 1, true);
              }}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? 'Loading...' : 'Load more saved stories'}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function ProfileScreen({
  mode = 'self',
  userId,
  getCurrentProfile = userService.getCurrentProfile,
  getPublicProfile = userService.getPublicProfile,
  updateCurrentProfile = userService.updateProfile,
  uploadProfilePhoto = userService.uploadProfilePhoto,
  removeProfilePhoto = userService.removeProfilePhoto,
  deleteAccount = userService.deleteAccount,
  followUser = userService.followUser,
  unfollowUser = userService.unfollowUser,
  getFollowers = userService.getFollowers,
  getFollowing = userService.getFollowing,
  getSavedStories = userService.getSavedStories,
  unbookmarkStory = interactionService.unbookmarkStory,
  onOpenUserProfile,
  onOpenStory,
  onStoryInteractionUpdated,
}: ProfileScreenProps) {
  const { user, isAuthenticated, updateUser, logout } = useAuth();
  const { toast } = useToast();
  const { colors, spacing, typography } = useAppTheme();
  const isSelfMode = mode === 'self';
  const [profile, setProfile] = useState<ProfileEntity | null>(null);
  const [formState, setFormState] = useState<ProfileFormState>(createFormState());
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhotoState | null>(null);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isBirthDateModalVisible, setIsBirthDateModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
  const [birthMonthDraft, setBirthMonthDraft] = useState<number>(0);
  const [birthDayDraft, setBirthDayDraft] = useState('1');
  const [birthYearDraft, setBirthYearDraft] = useState('1995');
  const [deletePassword, setDeletePassword] = useState('');
  const deletePasswordRef = useRef('');
  const [deleteError, setDeleteError] = useState<string>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string>();
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [followListMode, setFollowListMode] = useState<'followers' | 'following'>('followers');
  const [isFollowListVisible, setIsFollowListVisible] = useState(false);
  const [activeSelfTab, setActiveSelfTab] = useState<SelfProfileTab>('profile');
  const [savedStoriesCount, setSavedStoriesCount] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const savedStoriesSectionYRef = useRef(0);
  const shouldScrollToSavedStoriesRef = useRef(false);

  const resetPhotoDraft = useCallback(() => {
    setPendingPhoto(null);
    setIsPhotoRemoved(false);
  }, []);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const nextProfile = isSelfMode
        ? await getCurrentProfile()
        : await getPublicProfile(userId ?? '');
      const overrideKey = getFollowStateOverrideKey(user?.id, nextProfile.id);
      const overriddenFollowState = overrideKey ? followStateOverrides.get(overrideKey) : undefined;
      let resolvedFollowState =
        overriddenFollowState ??
        (typeof nextProfile.isFollowedByMe === 'boolean' ? nextProfile.isFollowedByMe : undefined);

      if (
        resolvedFollowState === undefined &&
        !isSelfMode &&
        isAuthenticated &&
        user?.id != null &&
        String(user.id) !== nextProfile.id
      ) {
        resolvedFollowState = await inferFollowStateFromFollowers({
          targetUserId: nextProfile.id,
          currentUserId: String(user.id),
          getFollowers,
        });
      }

      setProfile(nextProfile);
      setFollowersCount(nextProfile.followersCount ?? 0);
      setFollowingCount(nextProfile.followingCount ?? 0);
      setIsFollowing(Boolean(resolvedFollowState));
      setFormState(createFormState(nextProfile));
      resetPhotoDraft();
      setIsEditing(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this profile.');
    } finally {
      setIsLoading(false);
    }
  }, [getCurrentProfile, getFollowers, getPublicProfile, isAuthenticated, isSelfMode, resetPhotoDraft, user?.id, userId]);

  useEffect(() => {
    if (!isSelfMode && !userId) {
      setIsLoading(false);
      setError('A user id is required to open this public profile.');
      return;
    }

    void loadProfile();
  }, [isSelfMode, loadProfile, userId]);

  useEffect(() => {
    if (!isSelfMode || !profile?.id) {
      setSavedStoriesCount(null);
      return;
    }

    let isActive = true;

    setSavedStoriesCount(null);
    void getSavedStories(profile.id, 1)
      .then((result) => {
        if (isActive) {
          setSavedStoriesCount(result.totalCount);
        }
      })
      .catch(() => {
        if (isActive) {
          setSavedStoriesCount(0);
        }
      });

    return () => {
      isActive = false;
    };
  }, [getSavedStories, isSelfMode, profile?.id]);

  const validateForm = useCallback(() => {
    const nextErrors: FormErrors = {};
    const birthDateError = validateBirthDate(formState.birthDate);

    if (birthDateError) {
      nextErrors.birthDate = birthDateError;
    }

    if (formState.bio.length > BIO_MAX_LENGTH) {
      nextErrors.bio = `Bio must be ${BIO_MAX_LENGTH} characters or fewer.`;
    }

    const photoError = validatePendingPhoto(pendingPhoto);

    if (photoError) {
      nextErrors.photo = photoError;
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [formState.bio.length, formState.birthDate, pendingPhoto]);

  const handleSelectPhoto = useCallback(async () => {
    setFormErrors((current) => ({ ...current, photo: undefined }));

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError('Allow photo library access to choose a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const fileName = asset.fileName ?? `profile-photo-${Date.now()}.jpg`;
    const mimeType = resolveMimeType(fileName, asset.mimeType ?? null);
    const nextPhotoError =
      !mimeType
        ? 'Profile photo must be a JPG or PNG image.'
        : asset.fileSize && asset.fileSize > limits.maxProfilePhotoMb * 1024 * 1024
          ? `Photo must be ${limits.maxProfilePhotoMb} MB or smaller.`
          : undefined;

    if (!mimeType || nextPhotoError) {
      setFormErrors((current) => ({ ...current, photo: nextPhotoError ?? 'Unsupported image format.' }));
      return;
    }

    setPendingPhoto({
      uri: asset.uri,
      previewUri: asset.uri,
      fileName,
      fileSize: asset.fileSize ?? 0,
      mimeType,
    });
    setIsPhotoRemoved(false);
  }, []);

  const handleRemovePhoto = useCallback(() => {
    setFormErrors((current) => ({ ...current, photo: undefined }));
    setPendingPhoto(null);
    setIsPhotoRemoved(Boolean(profile?.profilePhoto));
  }, [profile?.profilePhoto]);

  const handleOpenBirthDateModal = useCallback(() => {
    const existingDate = parseBirthDate(formState.birthDate);
    setBirthMonthDraft(existingDate?.getUTCMonth() ?? 0);
    setBirthDayDraft(String(existingDate?.getUTCDate() ?? 1));
    setBirthYearDraft(String(existingDate?.getUTCFullYear() ?? 1995));
    setIsMonthPickerVisible(false);
    setIsBirthDateModalVisible(true);
  }, [formState.birthDate]);

  const normalizedBirthYear = Number.parseInt(birthYearDraft.replace(/[^0-9]/g, '').slice(0, 4), 10);
  const maxBirthDay = getDraftMaxBirthDay(birthYearDraft, birthMonthDraft);
  const normalizedBirthDay = Number.parseInt(birthDayDraft.replace(/[^0-9]/g, '').slice(0, 2), 10);

  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    const payload: UpdateProfileInput = {
      firstName: formState.firstName,
      lastName: formState.lastName,
      username: formState.username,
      isNamePublic: formState.isNamePublic,
      bio: formState.bio,
      location: formState.location,
      birthDate: formState.birthDate,
      isUsernamePublic: formState.isUsernamePublic,
      isLocationPublic: formState.isLocationPublic,
      isBirthDatePublic: formState.isBirthDatePublic,
      isPhotoPublic: formState.isPhotoPublic,
    };

    setIsSaving(true);
    setError(undefined);

    try {
      let updatedProfile = await updateCurrentProfile(payload);

      if (pendingPhoto) {
        updatedProfile = await uploadProfilePhoto(pendingPhoto);
      } else if (isPhotoRemoved && profile?.profilePhoto) {
        updatedProfile = await removeProfilePhoto();
      }

      setProfile(updatedProfile);
      setFormState({
        ...createFormState(updatedProfile),
        isBioPublic: formState.isBioPublic,
      });
      resetPhotoDraft();
      setIsEditing(false);
      await updateUser({
        isUsernamePublic: updatedProfile.isUsernamePublic,
        username: updatedProfile.username ?? user?.username ?? '',
      });
      toast.success('Profile updated successfully.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save your profile.');
    } finally {
      setIsSaving(false);
    }
  }, [
    formState,
    isPhotoRemoved,
    pendingPhoto,
    profile?.profilePhoto,
    removeProfilePhoto,
    resetPhotoDraft,
    toast,
    updateCurrentProfile,
    updateUser,
    uploadProfilePhoto,
      user?.username,
    validateForm,
  ]);

  const handleDeleteAccount = useCallback(async () => {
    const trimmedPassword = deletePasswordRef.current.trim();

    if (!trimmedPassword) {
      setDeleteError('Re-enter your password to continue.');
      return;
    }

    setDeleteError(undefined);
    setIsDeleting(true);

    try {
      await deleteAccount(trimmedPassword, true);
      await authService.clear();
      navigationRef.redirectToPublic?.();
      toast.success('Your account has been deleted.');
      setIsDeleteModalVisible(false);
      setDeletePassword('');
      deletePasswordRef.current = '';
    } catch (deleteAccountError) {
      setDeleteError(
        deleteAccountError instanceof Error ? deleteAccountError.message : 'Unable to delete your account.',
      );
    } finally {
      setIsDeleting(false);
    }
  }, [deleteAccount, toast]);

  const handleRequestLoginForFollow = useCallback(() => {
    toast.info('Please sign in to follow users.');
    navigationRef.redirectToAuth?.('unauthorized');
  }, [toast]);

  const handleToggleFollow = useCallback(async () => {
    if (!profile || isFollowLoading) {
      return;
    }

    const previousFollowing = isFollowing;
    const nextFollowing = !previousFollowing;
    const previousFollowersCount = followersCount;

    setIsFollowing(nextFollowing);
    setFollowersCount((current) => Math.max(0, current + (nextFollowing ? 1 : -1)));
    setIsFollowLoading(true);

    try {
      if (nextFollowing) {
        await followUser(profile.id);
      } else {
        await unfollowUser(profile.id);
      }

      const overrideKey = getFollowStateOverrideKey(user?.id, profile.id);

      if (overrideKey) {
        followStateOverrides.set(overrideKey, nextFollowing);
      }
    } catch {
      setIsFollowing(previousFollowing);
      setFollowersCount(previousFollowersCount);
      toast.error(
        nextFollowing
          ? 'Failed to follow user. Please try again.'
          : 'Failed to unfollow user. Please try again.',
      );
    } finally {
      setIsFollowLoading(false);
    }
  }, [followUser, followersCount, isFollowLoading, isFollowing, profile, toast, unfollowUser, user?.id]);

  const openFollowList = useCallback((modeToOpen: 'followers' | 'following') => {
    setFollowListMode(modeToOpen);
    setIsFollowListVisible(true);
  }, []);

  const handleOpenFollowUserProfile = useCallback(
    (targetUserId: string) => {
      if (onOpenUserProfile) {
        onOpenUserProfile(targetUserId);
        return;
      }

      navigationRef.navigateToUserProfile?.(targetUserId);
    },
    [onOpenUserProfile],
  );

  const title = useMemo(() => {
    if (isSelfMode) {
      return 'Your profile';
    }

    return 'User profile';
  }, [isSelfMode]);

  const resolvedName = profile?.username || (isSelfMode ? user?.username : null) || 'Anonymous user';
  const resolvedFullName = [profile?.firstName, profile?.lastName]
    .filter((value): value is string => Boolean(value))
    .join(' ');
  const joinedDate = formatJoinedDate(profile?.dateJoined);
  const birthDateDisplay = isSelfMode ? formatProfileBirthDate(profile?.birthDate) : undefined;
  const isDirty = useMemo(() => {
    if (!profile) {
      return false;
    }

    return (
      !areFormStatesEqual(formState, createFormState(profile)) ||
      Boolean(pendingPhoto) ||
      isPhotoRemoved
    );
  }, [formState, isPhotoRemoved, pendingPhoto, profile]);
  const profilePhotoUri = pendingPhoto?.previewUri ?? (isPhotoRemoved ? null : profile?.profilePhoto ?? null);
  const scrollToSavedStories = useCallback(() => {
    const y = savedStoriesSectionYRef.current;

    if (y <= 0) {
      return false;
    }

    scrollViewRef.current?.scrollTo({
      y: Math.max(y - spacing.md, 0),
      animated: true,
    });
    return true;
  }, [spacing.md]);

  useEffect(() => {
    if (activeSelfTab !== 'saved' || !shouldScrollToSavedStoriesRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      if (scrollToSavedStories()) {
        shouldScrollToSavedStoriesRef.current = false;
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [activeSelfTab, scrollToSavedStories]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error && !profile) {
    return (
      <ErrorState
        title="Profile unavailable"
        message={error}
        retryLabel="Try again"
        onRetry={() => {
          void loadProfile();
        }}
      />
    );
  }

  if (!profile) {
    return <Loader message="Loading profile..." />;
  }

  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        testID="profile-scroll-view"
        contentContainerStyle={{
          paddingBottom: spacing.xl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            padding: spacing.lg,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            gap: spacing.md,
          }}
        >
          {profilePhotoUri ? (
            <Image
              source={{ uri: profilePhotoUri }}
              accessibilityLabel="Profile photo preview"
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: colors.infoSurface,
              }}
            />
          ) : (
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.infoSurface,
              }}
            >
              <Text style={{ color: colors.primary, fontSize: typography.title, fontWeight: '800' }}>
                {resolvedName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}

          <View>
            <Text style={{ color: colors.muted, fontSize: typography.caption, textTransform: 'uppercase' }}>{title}</Text>
            <Text style={{ marginTop: spacing.xs, color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
              {resolvedName}
            </Text>
            {resolvedFullName ? (
              <Text style={{ marginTop: spacing.xs, color: colors.text, fontSize: typography.subtitle, fontWeight: '700' }}>
                {resolvedFullName}
              </Text>
            ) : null}
            {isSelfMode && profile.email ? (
              <Text style={{ marginTop: spacing.xs, color: colors.muted }}>{profile.email}</Text>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {joinedDate ? <StatChip label="Joined" value={joinedDate} /> : null}
            {isSelfMode ? <StatChip label="Points" value={String(profile.totalPoints)} /> : null}
            <StatChip label="Stories" value={String(profile.publishedStoryCount ?? 0)} />
            <StatButton
              label={followersCount === 1 ? 'Follower' : 'Followers'}
              value={String(followersCount)}
              onPress={() => openFollowList('followers')}
            />
            <StatButton
              label="Following"
              value={String(followingCount)}
              onPress={() => openFollowList('following')}
            />
            {isSelfMode ? (
              <StatButton
                label="Saved"
                value={savedStoriesCount === null ? '...' : String(savedStoriesCount)}
                accessibilityLabel="Show saved stories"
                selected={activeSelfTab === 'saved'}
                onPress={() => {
                  setActiveSelfTab((current) => {
                    const nextTab = current === 'saved' ? 'profile' : 'saved';
                    shouldScrollToSavedStoriesRef.current = nextTab === 'saved';
                    return nextTab;
                  });
                }}
              />
            ) : null}
            {profile.location ? <StatChip label="Location" value={profile.location} /> : null}
            {birthDateDisplay ? <StatChip label="Birth date" value={birthDateDisplay} /> : null}
            {profile.birthYear ? <StatChip label="Birth year" value={String(profile.birthYear)} /> : null}
          </View>

          {!isSelfMode ? (
            <FollowActionButton
              isAuthenticated={Boolean(isAuthenticated)}
              isFollowing={isFollowing}
              isLoading={isFollowLoading}
              onToggle={() => void handleToggleFollow()}
              onRequestLogin={handleRequestLoginForFollow}
            />
          ) : null}

          {profile.bio ? (
            <FieldCard title="Bio">
              <Text style={{ color: colors.text }}>{profile.bio}</Text>
            </FieldCard>
          ) : null}
        </View>

        {isSelfMode && activeSelfTab === 'saved' ? (
          <View
            testID="profile-saved-stories-wrapper"
            onLayout={(event) => {
              savedStoriesSectionYRef.current = event.nativeEvent.layout.y;
              if (shouldScrollToSavedStoriesRef.current && scrollToSavedStories()) {
                shouldScrollToSavedStoriesRef.current = false;
              }
            }}
          >
            <SavedStoriesSection
              userId={profile.id}
              getSavedStories={getSavedStories}
              unbookmarkStory={unbookmarkStory}
              onTotalCountChange={setSavedStoriesCount}
              onOpenStory={onOpenStory}
              onStoryInteractionUpdated={onStoryInteractionUpdated}
            />
          </View>
        ) : null}

        {isSelfMode && activeSelfTab === 'profile' ? (
          <View
            style={{
              padding: spacing.lg,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              gap: spacing.md,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing.md,
              }}
            >
              <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
                Edit profile
              </Text>
              <Button
                onPress={() => {
                  setError(undefined);
                  setFormErrors({});
                  setIsEditing((current) => {
                    const nextValue = !current;

                    if (!nextValue) {
                      setFormState(createFormState(profile));
                      resetPhotoDraft();
                    }

                    return nextValue;
                  });
                }}
                variant="outline"
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </Button>
            </View>

            {isEditing ? (
              <>
                <FieldCard
                  title="Profile photo"
                  footer={
                    <ToggleRow
                      label="Show profile photo publicly"
                      value={formState.isPhotoPublic}
                      onToggle={() => {
                        setFormState((current) => ({ ...current, isPhotoPublic: !current.isPhotoPublic }));
                      }}
                    />
                  }
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    {profilePhotoUri ? (
                      <Image
                        source={{ uri: profilePhotoUri }}
                        accessibilityLabel="Selected profile photo"
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 32,
                          backgroundColor: colors.infoSurface,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 32,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.infoSurface,
                        }}
                      >
                        <Text style={{ color: colors.primary, fontSize: typography.subtitle, fontWeight: '800' }}>
                          {resolvedName.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, gap: spacing.sm }}>
                      <Button variant="outline" onPress={() => void handleSelectPhoto()}>
                        Choose Photo
                      </Button>
                      {profilePhotoUri ? (
                        <Button variant="outline" onPress={handleRemovePhoto}>
                          Remove Photo
                        </Button>
                      ) : null}
                    </View>
                  </View>
                  {formErrors.photo ? <Text style={{ color: colors.danger }}>{formErrors.photo}</Text> : null}
                  <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                    Accepts JPG, JPEG, and PNG files up to {limits.maxProfilePhotoMb} MB.
                  </Text>
                </FieldCard>

                <FieldCard title="Username">
                  <Input
                    accessibilityLabel="Username"
                    value={formState.username}
                    onChangeText={(value) => {
                      setFormState((current) => ({ ...current, username: value }));
                    }}
                    placeholder="Username"
                  />
                  <ToggleRow
                    label="Show username on your public profile"
                    value={formState.isUsernamePublic}
                    onToggle={() => {
                      setFormState((current) => ({ ...current, isUsernamePublic: !current.isUsernamePublic }));
                    }}
                  />
                </FieldCard>

                <FieldCard title="Name">
                  <Input
                    accessibilityLabel="First name"
                    value={formState.firstName}
                    onChangeText={(value) => {
                      setFormState((current) => ({ ...current, firstName: value }));
                    }}
                    placeholder="First name"
                    autoCapitalize="words"
                  />
                  <Input
                    accessibilityLabel="Last name"
                    value={formState.lastName}
                    onChangeText={(value) => {
                      setFormState((current) => ({ ...current, lastName: value }));
                    }}
                    placeholder="Last name"
                    autoCapitalize="words"
                  />
                  <ToggleRow
                    label="Show your full name publicly"
                    value={formState.isNamePublic}
                    onToggle={() => {
                      setFormState((current) => ({ ...current, isNamePublic: !current.isNamePublic }));
                    }}
                  />
                </FieldCard>

                <FieldCard title="Location">
                  <Input
                    accessibilityLabel="Location"
                    value={formState.location}
                    onChangeText={(value) => {
                      setFormState((current) => ({ ...current, location: value }));
                    }}
                    placeholder="Location"
                  />
                  <ToggleRow
                    label="Show location publicly"
                    value={formState.isLocationPublic}
                    onToggle={() => {
                      setFormState((current) => ({ ...current, isLocationPublic: !current.isLocationPublic }));
                    }}
                  />
                </FieldCard>

                <FieldCard title="Birth date">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open birth date picker"
                    onPress={handleOpenBirthDateModal}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.md,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Text style={{ color: colors.text }}>{formatBirthDateLabel(formState.birthDate)}</Text>
                  </Pressable>
                  {formErrors.birthDate ? <Text style={{ color: colors.danger }}>{formErrors.birthDate}</Text> : null}
                  <ToggleRow
                    label="Show birth date publicly"
                    value={formState.isBirthDatePublic}
                    onToggle={() => {
                      setFormState((current) => ({ ...current, isBirthDatePublic: !current.isBirthDatePublic }));
                    }}
                  />
                </FieldCard>

                <FieldCard title="Bio">
                  <Input
                    accessibilityLabel="Bio"
                    value={formState.bio}
                    onChangeText={(value) => {
                      setFormErrors((current) => ({ ...current, bio: undefined }));
                      setFormState((current) => ({ ...current, bio: value }));
                    }}
                    placeholder="Tell people about yourself"
                    multiline
                    numberOfLines={5}
                    style={{ minHeight: 120 }}
                    inputStyle={{ minHeight: 108 }}
                  />
                  <Text style={{ color: colors.muted, textAlign: 'right' }}>
                    {formState.bio.length}/{BIO_MAX_LENGTH}
                  </Text>
                  {formErrors.bio ? <Text style={{ color: colors.danger }}>{formErrors.bio}</Text> : null}
                  <ToggleRow
                    label="Show bio publicly"
                    value={formState.isBioPublic}
                    onToggle={() => {
                      setFormState((current) => ({ ...current, isBioPublic: !current.isBioPublic }));
                    }}
                  />
                  <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                    Bio privacy UI is ready, but it will start working after backend support is added.
                  </Text>
                </FieldCard>

                {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

                <Button onPress={() => void handleSave()} disabled={isSaving || !isDirty}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onPress={() => void logout()}>
                  Sign out
                </Button>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete Account"
                  onPress={() => {
                    setDeleteError(undefined);
                    setDeletePassword('');
                    deletePasswordRef.current = '';
                    setIsDeleteModalVisible(true);
                  }}
                  style={({ pressed }) => ({
                    alignSelf: 'flex-start',
                    paddingVertical: spacing.sm,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text style={{ color: colors.danger, fontWeight: '700' }}>Delete Account</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}

        {!isSelfMode ? (
          <View
            style={{
              padding: spacing.lg,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              gap: spacing.sm,
            }}
          >
            <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
              Stories
            </Text>
            <Text style={{ color: colors.muted }}>
              Stories are intentionally out of scope for this profile version and will be added later.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <FollowListModal
        visible={isFollowListVisible}
        mode={followListMode}
        userId={profile.id}
        fetchFollowers={getFollowers}
        fetchFollowing={getFollowing}
        currentUser={user}
        showCurrentUserAtTop={isFollowing}
        onClose={() => setIsFollowListVisible(false)}
        onOpenUserProfile={handleOpenFollowUserProfile}
      />

      <Modal
        animationType="slide"
        transparent
        visible={isDeleteModalVisible}
        onRequestClose={() => {
          if (!isDeleting) {
            setIsDeleteModalVisible(false);
          }
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(10, 10, 10, 0.35)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              if (!isDeleting) {
                setIsDeleteModalVisible(false);
              }
            }}
          />
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              paddingBottom: spacing.xl,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: colors.background,
              gap: spacing.md,
            }}
          >
            <Text style={{ color: colors.danger, fontSize: typography.caption, fontWeight: '800', textTransform: 'uppercase' }}>
              Delete account
            </Text>
            <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
              This action cannot be undone
            </Text>
            <View
              style={{
                padding: spacing.md,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.danger,
                backgroundColor: colors.dangerSurface,
                gap: spacing.sm,
              }}
            >
              <Text style={{ color: colors.text }}>Your account will be permanently deleted.</Text>
              <Text style={{ color: colors.text }}>
                Your stories, comments, and likes will also be permanently deleted.
              </Text>
            </View>
            <Input
              accessibilityLabel="Re-enter your password"
              value={deletePassword}
              onChangeText={(value) => {
                deletePasswordRef.current = value;
                setDeletePassword(value);
                if (deleteError) {
                  setDeleteError(undefined);
                }
              }}
              placeholder="Re-enter your password"
              secureTextEntry
            />
            {deleteError ? <Text style={{ color: colors.danger }}>{deleteError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm account deletion"
              disabled={isDeleting}
              onPress={() => void handleDeleteAccount()}
              style={({ pressed }) => ({
                width: '100%',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md - 2,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.danger,
                opacity: isDeleting ? 0.7 : pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: colors.background, fontWeight: '700' }}>
                {isDeleting ? 'Deleting Account...' : 'Delete My Account'}
              </Text>
            </Pressable>
            <Button
              variant="outline"
              onPress={() => {
                setIsDeleteModalVisible(false);
              }}
              disabled={isDeleting}
              fullWidth
            >
              Cancel
            </Button>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={isBirthDateModalVisible}
        onRequestClose={() => setIsBirthDateModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(10, 10, 10, 0.35)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setIsBirthDateModalVisible(false)} />
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              paddingBottom: spacing.xl,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: colors.background,
              gap: spacing.md,
            }}
          >
            <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
              Select birth date
            </Text>
            <Text style={{ color: colors.muted }}>
              {birthYearDraft && birthDayDraft
                ? `${MONTH_OPTIONS[birthMonthDraft]} ${birthDayDraft}, ${birthYearDraft}`
                : 'Choose month, then enter day and year.'}
            </Text>

            <View style={{ gap: spacing.sm }}>
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Month</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open month picker"
                  onPress={() => setIsMonthPickerVisible((current) => !current)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{MONTH_OPTIONS[birthMonthDraft]}</Text>
                </Pressable>
                {isMonthPickerVisible ? (
                  <View
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      padding: spacing.sm,
                      gap: spacing.xs,
                    }}
                  >
                    {MONTH_OPTIONS.map((month, index) => {
                      const active = index === birthMonthDraft;

                      return (
                        <Pressable
                          key={month}
                          accessibilityRole="button"
                          accessibilityLabel={`Select ${month}`}
                          onPress={() => {
                            setBirthMonthDraft(index);
                            setBirthDayDraft((current) =>
                              clampDayInput(current, getDraftMaxBirthDay(birthYearDraft, index)),
                            );
                            setIsMonthPickerVisible(false);
                          }}
                          style={{
                            paddingHorizontal: spacing.md,
                            paddingVertical: spacing.sm,
                            borderRadius: 12,
                            backgroundColor: active ? colors.infoSurface : colors.background,
                          }}
                        >
                          <Text style={{ color: active ? colors.primary : colors.text, fontWeight: active ? '700' : '500' }}>
                            {month}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>Day</Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: spacing.sm,
                    }}
                  >
                    <Button
                      variant="outline"
                      onPress={() => {
                        const nextDay = Number.isFinite(normalizedBirthDay)
                          ? Math.max(normalizedBirthDay - 1, 1)
                          : 1;
                        setBirthDayDraft(String(nextDay));
                      }}
                    >
                      -
                    </Button>
                    <View style={{ flex: 1 }}>
                      <Input
                        accessibilityLabel="Birth day"
                        value={birthDayDraft}
                        onChangeText={(value) => {
                          setBirthDayDraft(clampDayInput(value, maxBirthDay));
                        }}
                        placeholder="DD"
                        keyboardType="numeric"
                      />
                    </View>
                    <Button
                      variant="outline"
                      onPress={() => {
                        const nextDay = Number.isFinite(normalizedBirthDay)
                          ? Math.min(normalizedBirthDay + 1, maxBirthDay)
                          : 1;
                        setBirthDayDraft(String(nextDay));
                      }}
                    >
                      +
                    </Button>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                    Day range: 1-{maxBirthDay}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>Year</Text>
                  <Input
                    accessibilityLabel="Birth year"
                    value={birthYearDraft}
                    onChangeText={(value) => {
                      const normalizedYearValue = value.replace(/[^0-9]/g, '').slice(0, 4);
                      setBirthYearDraft(normalizedYearValue);
                      setBirthDayDraft((current) =>
                        clampDayInput(current, getDraftMaxBirthDay(normalizedYearValue, birthMonthDraft)),
                      );
                    }}
                    placeholder="YYYY"
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                Enter the calendar day and full year. We will validate the date when you save it.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                  onPress={() => {
                    const clampedDate = clampBirthDateParts(birthYearDraft, birthMonthDraft, birthDayDraft);
                    const normalizedDay = clampedDate.day;
                    const normalizedYear = clampedDate.year;
                    const nextBirthDate =
                      normalizedDay && normalizedYear
                      ? `${normalizedYear.padStart(4, '0')}-${`${clampedDate.monthIndex + 1}`.padStart(2, '0')}-${normalizedDay.padStart(2, '0')}`
                      : '';
                  setFormErrors((current) => ({ ...current, birthDate: undefined }));
                  setFormState((current) => ({ ...current, birthDate: nextBirthDate }));
                  setBirthMonthDraft(clampedDate.monthIndex);
                  setBirthDayDraft(clampedDate.day);
                  setBirthYearDraft(clampedDate.year);
                  setIsBirthDateModalVisible(false);
                }}
              >
                Use Date
              </Button>
              <Button
                variant="outline"
                onPress={() => {
                  setFormErrors((current) => ({ ...current, birthDate: undefined }));
                  setFormState((current) => ({ ...current, birthDate: '' }));
                  setIsBirthDateModalVisible(false);
                }}
              >
                Clear
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
