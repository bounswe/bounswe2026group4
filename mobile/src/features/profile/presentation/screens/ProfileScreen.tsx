import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { navigationRef } from '../../../../app/navigation/navigationRef';
import { limits } from '../../../../core/constants/limits';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Button, ErrorState, Input, Loader, Skeleton } from '../../../../shared';
import { useToast } from '../../../../shared/hooks/useToast';
import { authService } from '../../../auth/application/services';
import { useAuth } from '../../../auth';
import { userService } from '../../application/services';
import { ProfileEntity, ProfilePhotoUploadInput, UpdateProfileInput } from '../../domain/entities';

type ProfileMode = 'self' | 'public';

const BIO_MAX_LENGTH = 280;
const MIN_BIRTH_YEAR = 1900;
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

export function ProfileScreen({
  mode = 'self',
  userId,
  getCurrentProfile = userService.getCurrentProfile,
  getPublicProfile = userService.getPublicProfile,
  updateCurrentProfile = userService.updateProfile,
  uploadProfilePhoto = userService.uploadProfilePhoto,
  removeProfilePhoto = userService.removeProfilePhoto,
  deleteAccount = userService.deleteAccount,
}: ProfileScreenProps) {
  const { user, updateUser, logout } = useAuth();
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

      setProfile(nextProfile);
      setFormState(createFormState(nextProfile));
      resetPhotoDraft();
      setIsEditing(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this profile.');
    } finally {
      setIsLoading(false);
    }
  }, [getCurrentProfile, getPublicProfile, isSelfMode, resetPhotoDraft, userId]);

  useEffect(() => {
    if (!isSelfMode && !userId) {
      setIsLoading(false);
      setError('A user id is required to open this public profile.');
      return;
    }

    void loadProfile();
  }, [isSelfMode, loadProfile, userId]);

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
            {profile.location ? <StatChip label="Location" value={profile.location} /> : null}
            {profile.birthYear ? <StatChip label="Birth year" value={String(profile.birthYear)} /> : null}
          </View>

          {profile.bio ? (
            <FieldCard title="Bio">
              <Text style={{ color: colors.text }}>{profile.bio}</Text>
            </FieldCard>
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
