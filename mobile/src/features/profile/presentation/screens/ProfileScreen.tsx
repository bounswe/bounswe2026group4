import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Button, ErrorState, Input, Loader, Skeleton } from '../../../../shared';
import { useAuth } from '../../../auth';
import { userService } from '../../application/services';
import { ProfileEntity, UpdateProfileInput } from '../../domain/entities';

type ProfileMode = 'self' | 'public';

interface ProfileScreenProps {
  mode?: ProfileMode;
  userId?: string;
  getCurrentProfile?: typeof userService.getCurrentProfile;
  getPublicProfile?: typeof userService.getPublicProfile;
  updateCurrentProfile?: typeof userService.updateCurrentProfile;
}

interface ProfileFormState {
  username: string;
  bio: string;
  location: string;
  birthDate: string;
  isUsernamePublic: boolean;
  isLocationPublic: boolean;
  isBirthDatePublic: boolean;
  isPhotoPublic: boolean;
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

function createFormState(profile?: ProfileEntity | null): ProfileFormState {
  return {
    username: profile?.username ?? '',
    bio: profile?.bio ?? '',
    location: profile?.location ?? '',
    birthDate: profile?.birthDate ?? '',
    isUsernamePublic: profile?.isUsernamePublic ?? true,
    isLocationPublic: profile?.isLocationPublic ?? true,
    isBirthDatePublic: profile?.isBirthDatePublic ?? true,
    isPhotoPublic: profile?.isPhotoPublic ?? true,
  };
}

function areFormStatesEqual(left: ProfileFormState, right: ProfileFormState) {
  return (
    left.username === right.username &&
    left.bio === right.bio &&
    left.location === right.location &&
    left.birthDate === right.birthDate &&
    left.isUsernamePublic === right.isUsernamePublic &&
    left.isLocationPublic === right.isLocationPublic &&
    left.isBirthDatePublic === right.isBirthDatePublic &&
    left.isPhotoPublic === right.isPhotoPublic
  );
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

export function ProfileScreen({
  mode = 'self',
  userId,
  getCurrentProfile = userService.getCurrentProfile,
  getPublicProfile = userService.getPublicProfile,
  updateCurrentProfile = userService.updateCurrentProfile,
}: ProfileScreenProps) {
  const { user, updateUser, logout } = useAuth();
  const { colors, spacing, typography } = useAppTheme();
  const isSelfMode = mode === 'self';
  const [profile, setProfile] = useState<ProfileEntity | null>(null);
  const [formState, setFormState] = useState<ProfileFormState>(createFormState());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [saveMessage, setSaveMessage] = useState<string>();

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    setSaveMessage(undefined);

    try {
      const nextProfile = isSelfMode
        ? await getCurrentProfile()
        : await getPublicProfile(userId ?? '');

      setProfile(nextProfile);
      setFormState(createFormState(nextProfile));
      setIsEditing(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this profile.');
    } finally {
      setIsLoading(false);
    }
  }, [getCurrentProfile, getPublicProfile, isSelfMode, userId]);

  useEffect(() => {
    if (!isSelfMode && !userId) {
      setIsLoading(false);
      setError('A user id is required to open this public profile.');
      return;
    }

    void loadProfile();
  }, [isSelfMode, loadProfile, userId]);

  const handleSave = useCallback(async () => {
    const payload: UpdateProfileInput = {
      username: formState.username,
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
    setSaveMessage(undefined);

    try {
      const updatedProfile = await updateCurrentProfile(payload);
      setProfile(updatedProfile);
      setFormState(createFormState(updatedProfile));
      await updateUser({
        isUsernamePublic: updatedProfile.isUsernamePublic,
        username: updatedProfile.username ?? user?.username ?? '',
      });
      setSaveMessage('Profile updated successfully.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save your profile.');
    } finally {
      setIsSaving(false);
    }
  }, [formState, updateCurrentProfile, updateUser, user?.username]);

  const title = useMemo(() => {
    if (isSelfMode) {
      return 'Your profile';
    }

    return 'User profile';
  }, [isSelfMode]);

  const resolvedName = profile?.username || (isSelfMode ? user?.username : null) || 'Anonymous user';
  const joinedDate = formatJoinedDate(profile?.dateJoined);
  const isDirty = useMemo(() => {
    if (!profile) {
      return false;
    }

    return !areFormStatesEqual(formState, createFormState(profile));
  }, [formState, profile]);

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
    <ScrollView
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
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.infoSurface,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: typography.title, fontWeight: '800' }}>
            {resolvedName.slice(0, 1).toUpperCase()}
          </Text>
        </View>

        <View>
          <Text style={{ color: colors.muted, fontSize: typography.caption, textTransform: 'uppercase' }}>{title}</Text>
          <Text style={{ marginTop: spacing.xs, color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
            {resolvedName}
          </Text>
          {isSelfMode && profile.email ? (
            <Text style={{ marginTop: spacing.xs, color: colors.muted }}>{profile.email}</Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {joinedDate ? <StatChip label="Joined" value={joinedDate} /> : null}
          {isSelfMode ? <StatChip label="Points" value={String(profile.totalPoints)} /> : null}
          <StatChip label="Stories" value={String(profile.publishedStoryCount ?? 0)} />
          {profile.location ? <StatChip label="Location" value={profile.location} /> : null}
          {profile.birthYear ? <StatChip label="Birth year" value={String(profile.birthYear)} /> : null}
        </View>

        {profile.bio ? (
          <View
            style={{
              padding: spacing.md,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: typography.caption, textTransform: 'uppercase' }}>Bio</Text>
            <Text style={{ marginTop: spacing.sm, color: colors.text }}>{profile.bio}</Text>
          </View>
        ) : null}
      </View>

      {isSelfMode ? (
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
                setSaveMessage(undefined);
                setError(undefined);
                setIsEditing((current) => {
                  const nextValue = !current;

                  if (!nextValue) {
                    setFormState(createFormState(profile));
                  }

                  return nextValue;
                });
              }}
              variant="outline"
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {isEditing ? 'Cancel' : 'Edit profile'}
              </Text>
            </Button>
          </View>

          {saveMessage ? <Text style={{ color: colors.success }}>{saveMessage}</Text> : null}

          {isEditing ? (
            <>
              <Input
                accessibilityLabel="Username"
                value={formState.username}
                onChangeText={(value) => {
                  setSaveMessage(undefined);
                  setFormState((current) => ({ ...current, username: value }));
                }}
                placeholder="Username"
              />
              <Input
                accessibilityLabel="Location"
                value={formState.location}
                onChangeText={(value) => {
                  setSaveMessage(undefined);
                  setFormState((current) => ({ ...current, location: value }));
                }}
                placeholder="Location"
              />
              <Input
                accessibilityLabel="Birth date"
                value={formState.birthDate}
                onChangeText={(value) => {
                  setSaveMessage(undefined);
                  setFormState((current) => ({ ...current, birthDate: value }));
                }}
                placeholder="YYYY-MM-DD"
              />
              <Input
                accessibilityLabel="Bio"
                value={formState.bio}
                onChangeText={(value) => {
                  setSaveMessage(undefined);
                  setFormState((current) => ({ ...current, bio: value }));
                }}
                placeholder="Tell people about yourself"
                style={{ minHeight: 110, textAlignVertical: 'top' as const }}
              />

              <ToggleRow
                label="Show username on your public profile"
                value={formState.isUsernamePublic}
                onToggle={() => {
                  setSaveMessage(undefined);
                  setFormState((current) => ({ ...current, isUsernamePublic: !current.isUsernamePublic }));
                }}
              />
              <ToggleRow
                label="Show location publicly"
                value={formState.isLocationPublic}
                onToggle={() => {
                  setSaveMessage(undefined);
                  setFormState((current) => ({ ...current, isLocationPublic: !current.isLocationPublic }));
                }}
              />
              <ToggleRow
                label="Show birth date publicly"
                value={formState.isBirthDatePublic}
                onToggle={() => {
                  setSaveMessage(undefined);
                  setFormState((current) => ({ ...current, isBirthDatePublic: !current.isBirthDatePublic }));
                }}
              />
              <ToggleRow
                label="Show profile photo publicly"
                value={formState.isPhotoPublic}
                onToggle={() => {
                  setSaveMessage(undefined);
                  setFormState((current) => ({ ...current, isPhotoPublic: !current.isPhotoPublic }));
                }}
              />

              {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

              {isDirty || isSaving ? (
                <Button onPress={() => void handleSave()} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save changes'}
                </Button>
              ) : null}
            </>
          ) : (
            <Button variant="outline" onPress={() => void logout()}>
              Sign out
            </Button>
          )}
        </View>
      ) : (
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
      )}
    </ScrollView>
  );
}
