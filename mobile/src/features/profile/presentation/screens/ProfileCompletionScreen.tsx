import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { limits } from '../../../../core/constants/limits';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Button, Input } from '../../../../shared';
import { useToast } from '../../../../shared/hooks/useToast';
import { userService } from '../../application/services';
import { ProfileEntity, ProfilePhotoUploadInput } from '../../domain/entities';

type FieldErrors = {
  firstName?: string;
  lastName?: string;
  location?: string;
  birthDate?: string;
  bio?: string;
  photo?: string;
};

type StepKey = 'identity' | 'photo' | 'location' | 'birthDate' | 'bio';

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

interface PendingPhotoState extends ProfilePhotoUploadInput {
  fileSize: number;
  previewUri: string;
}

interface ProfileCompletionScreenProps {
  onCompleted?: (profile: ProfileEntity) => void;
  updateCurrentProfile?: typeof userService.updateCurrentProfile;
  uploadProfilePhoto?: typeof userService.uploadProfilePhoto;
}

const STEPS: Array<{
  key: StepKey;
  title: string;
}> = [
  {
    key: 'identity',
    title: 'Your details',
  },
  {
    key: 'photo',
    title: 'Profile photo',
  },
  {
    key: 'location',
    title: 'Location',
  },
  {
    key: 'birthDate',
    title: 'Birth date',
  },
  {
    key: 'bio',
    title: 'Bio',
  },
];

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

function clampBirthDateParts(yearValue: string, monthIndex: number, dayValue: string) {
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

function validateBirthDate(value: string) {
  if (!value) {
    return undefined;
  }

  const parsedDate = parseBirthDate(value);

  if (!parsedDate) {
    return 'Use the YYYY-MM-DD format for a valid date.';
  }

  if (parsedDate.getFullYear() < MIN_BIRTH_YEAR) {
    return `Birth date must be after ${MIN_BIRTH_YEAR}.`;
  }

  if (parsedDate.getTime() > Date.now()) {
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

function validatePhoto(photo: PendingPhotoState | null) {
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

function StepIndicator({
  currentStepIndex,
}: {
  currentStepIndex: number;
}) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
      {STEPS.map((step, index) => {
        const isActive = index === currentStepIndex;
        const isCompleted = index < currentStepIndex;

        return (
          <View
            key={step.key}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 999,
              backgroundColor: isCompleted || isActive ? colors.primary : colors.border,
              opacity: isActive ? 1 : isCompleted ? 0.8 : 1,
            }}
            accessibilityLabel={`Progress step ${index + 1}`}
          >
            {isActive ? (
              <Text
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 0,
                  color: colors.muted,
                  fontSize: typography.caption,
                }}
              >
                {index + 1}/{STEPS.length}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function PrivacyToggle({
  label,
  hint,
  value,
  onToggle,
}: {
  label: string;
  hint: string;
  value: boolean;
  onToggle: () => void;
}) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      onPress={onToggle}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md - 2,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={{ color: colors.text, fontSize: typography.body, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: colors.muted, fontSize: typography.caption }}>{hint}</Text>
      </View>
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 999,
          backgroundColor: value ? colors.infoSurface : colors.surface,
          borderWidth: 1,
          borderColor: value ? colors.primary : colors.border,
        }}
      >
        <Text style={{ color: value ? colors.primary : colors.muted, fontWeight: '700' }}>
          {value ? 'Public' : 'Private'}
        </Text>
      </View>
    </Pressable>
  );
}

export function ProfileCompletionScreen({
  onCompleted,
  updateCurrentProfile = userService.updateCurrentProfile,
  uploadProfilePhoto = userService.uploadProfilePhoto,
}: ProfileCompletionScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { toast } = useToast();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [location, setLocation] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [bio, setBio] = useState('');
  const [isBioPublic, setIsBioPublic] = useState(true);
  const [isLocationPublic, setIsLocationPublic] = useState(true);
  const [isBirthDatePublic, setIsBirthDatePublic] = useState(false);
  const [isPhotoPublic, setIsPhotoPublic] = useState(true);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhotoState | null>(null);
  const [isBirthDateModalVisible, setIsBirthDateModalVisible] = useState(false);
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
  const [birthMonthDraft, setBirthMonthDraft] = useState<number>(0);
  const [birthDayDraft, setBirthDayDraft] = useState('1');
  const [birthYearDraft, setBirthYearDraft] = useState('1995');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  const currentStep = STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === STEPS.length - 1;
  const canGoBack = currentStepIndex > 0 && !isSaving;
  const normalizedBirthYear = Number.parseInt(birthYearDraft.replace(/[^0-9]/g, '').slice(0, 4), 10);
  const maxBirthDay = getDraftMaxBirthDay(birthYearDraft, birthMonthDraft);
  const normalizedBirthDay = Number.parseInt(birthDayDraft.replace(/[^0-9]/g, '').slice(0, 2), 10);

  const clearFieldError = useCallback((field: keyof FieldErrors) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const validateCurrentStep = useCallback((stepKey: StepKey) => {
    const nextErrors: FieldErrors = {};

    if (stepKey === 'identity') {
      if (!firstName.trim()) {
        nextErrors.firstName = 'Name is required.';
      } else if (firstName.trim().length > 150) {
        nextErrors.firstName = 'Name must be 150 characters or fewer.';
      }

      if (!lastName.trim()) {
        nextErrors.lastName = 'Surname is required.';
      } else if (lastName.trim().length > 150) {
        nextErrors.lastName = 'Surname must be 150 characters or fewer.';
      }
    }

    if (stepKey === 'photo') {
      const photoError = validatePhoto(pendingPhoto);

      if (photoError) {
        nextErrors.photo = photoError;
      }
    }

    if (stepKey === 'location' && location.length > 255) {
      nextErrors.location = 'Location cannot exceed 255 characters.';
    }

    if (stepKey === 'birthDate') {
      const birthDateError = validateBirthDate(birthDate);

      if (birthDateError) {
        nextErrors.birthDate = birthDateError;
      }
    }

    if (stepKey === 'bio' && bio.length > 1000) {
      nextErrors.bio = 'Bio must be 1000 characters or fewer.';
    }

    setFieldErrors((current) => ({ ...current, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  }, [bio.length, birthDate, firstName, lastName, location.length, pendingPhoto]);

  const extractErrors = useCallback((error: unknown) => {
    const data = (error as { response?: { data?: unknown } })?.response?.data as
      | {
          message?: string;
          detail?: string;
          errors?: {
            profile?: Record<string, string | string[]>;
            photo?: string | string[];
          };
        }
      | undefined;
    const profileErrors = data?.errors?.profile;
    const nextFieldErrors: FieldErrors = {};

    const readMessage = (value: unknown) => {
      if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
      }

      return typeof value === 'string' ? value : undefined;
    };

    if (profileErrors) {
      nextFieldErrors.firstName = readMessage(profileErrors.first_name);
      nextFieldErrors.lastName = readMessage(profileErrors.last_name);
      nextFieldErrors.location = readMessage(profileErrors.location);
      nextFieldErrors.birthDate = readMessage(profileErrors.birth_date);
      nextFieldErrors.bio = readMessage(profileErrors.bio);
    }

    if (data?.errors?.photo) {
      nextFieldErrors.photo = readMessage(data.errors.photo);
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors((current) => ({ ...current, ...nextFieldErrors }));
      return undefined;
    }

    return data?.message ?? data?.detail ?? (error instanceof Error ? error.message : 'Unable to save your profile.');
  }, []);

  const submit = useCallback(async () => {
    setApiError(undefined);
    setIsSaving(true);

    try {
      let nextProfile = await updateCurrentProfile({
        firstName,
        lastName,
        isNamePublic: true,
        location,
        birthDate: birthDate || null,
        bio,
        isLocationPublic,
        isBirthDatePublic,
        isPhotoPublic,
      });

      if (pendingPhoto) {
        nextProfile = await uploadProfilePhoto(pendingPhoto);
      }

      toast.success('Profile saved. You are all set.');
      onCompleted?.(nextProfile);
    } catch (error) {
      const message = extractErrors(error);

      if (message) {
        setApiError(message);
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    birthDate,
    bio,
    extractErrors,
    firstName,
    isBirthDatePublic,
    isLocationPublic,
    isPhotoPublic,
    lastName,
    location,
    onCompleted,
    pendingPhoto,
    toast,
    updateCurrentProfile,
    uploadProfilePhoto,
  ]);

  const advance = useCallback(async () => {
    setApiError(undefined);

    if (!validateCurrentStep(currentStep.key)) {
      return;
    }

    if (isLastStep) {
      await submit();
      return;
    }

    setCurrentStepIndex((current) => current + 1);
  }, [currentStep.key, isLastStep, submit, validateCurrentStep]);

  const handleOpenBirthDateModal = useCallback(() => {
    const existingDate = parseBirthDate(birthDate);
    setBirthMonthDraft(existingDate?.getUTCMonth() ?? 0);
    setBirthDayDraft(String(existingDate?.getUTCDate() ?? 1));
    setBirthYearDraft(String(existingDate?.getUTCFullYear() ?? 1995));
    setIsMonthPickerVisible(false);
    setIsBirthDateModalVisible(true);
  }, [birthDate]);

  const handleSelectPhoto = useCallback(async () => {
    clearFieldError('photo');
    setApiError(undefined);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setApiError('Allow photo library access to choose a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 1,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const fileName = asset.fileName ?? `profile-photo-${Date.now()}.jpg`;
    const mimeType = resolveMimeType(fileName, asset.mimeType ?? null);

    if (!mimeType) {
      setFieldErrors((current) => ({ ...current, photo: 'Profile photo must be a JPG or PNG image.' }));
      return;
    }

    const nextPhoto: PendingPhotoState = {
      uri: asset.uri,
      previewUri: asset.uri,
      fileName,
      fileSize: asset.fileSize ?? 0,
      mimeType,
    };
    const photoError = validatePhoto(nextPhoto);

    if (photoError) {
      setFieldErrors((current) => ({ ...current, photo: photoError }));
      return;
    }

    setPendingPhoto(nextPhoto);
  }, [clearFieldError]);

  const screenBody = useMemo(() => {
    switch (currentStep.key) {
      case 'identity':
        return (
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                Name <Text style={{ color: colors.danger }}>*</Text>
              </Text>
              <Input
                value={firstName}
                onChangeText={(value) => {
                  setFirstName(value);
                  clearFieldError('firstName');
                }}
                accessibilityLabel="Name"
                placeholder="Your name"
                editable={!isSaving}
                autoCapitalize="words"
                autoComplete="name-given"
                textContentType="givenName"
              />
              {fieldErrors.firstName ? <Text style={{ color: colors.danger }}>{fieldErrors.firstName}</Text> : null}
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                Surname <Text style={{ color: colors.danger }}>*</Text>
              </Text>
              <Input
                value={lastName}
                onChangeText={(value) => {
                  setLastName(value);
                  clearFieldError('lastName');
                }}
                accessibilityLabel="Surname"
                placeholder="Your surname"
                editable={!isSaving}
                autoCapitalize="words"
                autoComplete="name-family"
                textContentType="familyName"
              />
              {fieldErrors.lastName ? <Text style={{ color: colors.danger }}>{fieldErrors.lastName}</Text> : null}
            </View>
          </View>
        );
      case 'photo':
        return (
          <View style={{ gap: spacing.md }}>
            {pendingPhoto ? (
              <Image
                source={{ uri: pendingPhoto.previewUri }}
                accessibilityLabel="Selected profile photo"
                style={{
                  width: 104,
                  height: 104,
                  borderRadius: 28,
                  backgroundColor: colors.infoSurface,
                  alignSelf: 'center',
                }}
              />
            ) : (
              <View
                style={{
                  width: 104,
                  height: 104,
                  borderRadius: 28,
                  alignSelf: 'center',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.infoSurface,
                }}
              >
                <Text style={{ color: colors.primary, fontSize: typography.title, fontWeight: '800' }}>
                  {firstName.trim().slice(0, 1).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button onPress={() => void handleSelectPhoto()} disabled={isSaving}>
                {pendingPhoto ? 'Choose another photo' : 'Choose photo'}
              </Button>
              {pendingPhoto ? (
                <Button variant="outline" onPress={() => setPendingPhoto(null)} disabled={isSaving}>
                  Remove
                </Button>
              ) : null}
            </View>
            <PrivacyToggle
              label="Photo visibility"
              hint="Choose whether your photo appears on your public profile."
              value={isPhotoPublic}
              onToggle={() => setIsPhotoPublic((current) => !current)}
            />
            {fieldErrors.photo ? <Text style={{ color: colors.danger }}>{fieldErrors.photo}</Text> : null}
          </View>
        );
      case 'location':
        return (
          <View style={{ gap: spacing.md }}>
            <Input
              value={location}
              onChangeText={(value) => {
                setLocation(value);
                clearFieldError('location');
              }}
              accessibilityLabel="Location"
              placeholder="City, district, or region"
              editable={!isSaving}
              autoCapitalize="words"
            />
            <Text style={{ color: colors.muted, fontSize: typography.caption }}>{location.length}/255 characters</Text>
            <PrivacyToggle
              label="Location visibility"
              hint="Show or hide your location on your public profile."
              value={isLocationPublic}
              onToggle={() => setIsLocationPublic((current) => !current)}
            />
            {fieldErrors.location ? <Text style={{ color: colors.danger }}>{fieldErrors.location}</Text> : null}
          </View>
        );
      case 'birthDate':
        return (
          <View style={{ gap: spacing.md }}>
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
                backgroundColor: colors.background,
              }}
            >
              <Text style={{ color: birthDate ? colors.text : colors.muted }}>{formatBirthDateLabel(birthDate)}</Text>
            </Pressable>
            <PrivacyToggle
              label="Birth date visibility"
              hint="Control whether your birth date is visible to others."
              value={isBirthDatePublic}
              onToggle={() => setIsBirthDatePublic((current) => !current)}
            />
            {fieldErrors.birthDate ? <Text style={{ color: colors.danger }}>{fieldErrors.birthDate}</Text> : null}
          </View>
        );
      case 'bio':
        return (
          <View style={{ gap: spacing.md }}>
            <Input
              value={bio}
              onChangeText={(value) => {
                setBio(value);
                clearFieldError('bio');
              }}
              accessibilityLabel="Bio"
              placeholder="A quick intro"
              editable={!isSaving}
              multiline
              numberOfLines={4}
              autoCapitalize="sentences"
              inputStyle={{ minHeight: 112 }}
            />
            <Text style={{ color: colors.muted, fontSize: typography.caption }}>{bio.length}/1000 characters</Text>
            {fieldErrors.bio ? <Text style={{ color: colors.danger }}>{fieldErrors.bio}</Text> : null}
            <PrivacyToggle
              label="Show bio publicly"
              hint="Bio privacy UI is ready and will work once backend support is added."
              value={isBioPublic}
              onToggle={() => setIsBioPublic((current) => !current)}
            />
          </View>
        );
    }
  }, [
    bio,
    birthDate,
    clearFieldError,
    colors.danger,
    colors.infoSurface,
    colors.muted,
    colors.primary,
    colors.text,
    currentStep.key,
    fieldErrors.bio,
    fieldErrors.birthDate,
    fieldErrors.firstName,
    fieldErrors.lastName,
    fieldErrors.location,
    fieldErrors.photo,
    firstName,
    handleOpenBirthDateModal,
    handleSelectPhoto,
    isBioPublic,
    isBirthDatePublic,
    isLocationPublic,
    isPhotoPublic,
    isSaving,
    lastName,
    location,
    pendingPhoto,
    spacing.md,
    spacing.sm,
    typography.caption,
    typography.title,
  ]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="always"
        contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xl + spacing.md }}
      >
        <View style={{ gap: spacing.lg }}>
          <View
            style={{
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing.lg,
              gap: spacing.sm,
            }}
          >
            <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
              Complete your profile
            </Text>
            <StepIndicator currentStepIndex={currentStepIndex} />
          </View>

          <View
            style={{
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing.lg,
              gap: spacing.lg,
            }}
          >
            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
                {currentStep.title}
              </Text>
            </View>

            {screenBody}

            {apiError ? (
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.danger,
                  backgroundColor: colors.dangerSurface,
                  padding: spacing.md,
                }}
              >
                <Text style={{ color: colors.danger }}>{apiError}</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {canGoBack ? (
                <Button variant="outline" onPress={() => setCurrentStepIndex((current) => current - 1)} disabled={isSaving}>
                  Back
                </Button>
              ) : null}
              <View style={{ flex: 1 }}>
                <Button onPress={() => void advance()} disabled={isSaving} fullWidth>
                  {isSaving ? 'Saving profile...' : isLastStep ? 'Finish' : 'Continue'}
                </Button>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

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
                  setFieldErrors((current) => ({ ...current, birthDate: undefined }));
                  setBirthDate(nextBirthDate);
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
                  setFieldErrors((current) => ({ ...current, birthDate: undefined }));
                  setBirthDate('');
                  setIsBirthDateModalVisible(false);
                }}
              >
                Clear
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
