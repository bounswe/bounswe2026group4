import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
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

function validateBirthDate(value: string) {
  if (!value) {
    return undefined;
  }

  const parsedDate = parseBirthDate(value);

  if (!parsedDate) {
    return 'Use the YYYY-MM-DD format for a valid date.';
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  const currentStep = STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === STEPS.length - 1;
  const canGoBack = currentStepIndex > 0 && !isSaving;

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
            <Input
              value={birthDate}
              onChangeText={(value) => {
                setBirthDate(value);
                clearFieldError('birthDate');
              }}
              accessibilityLabel="Birth date"
              placeholder="YYYY-MM-DD"
              editable={!isSaving}
              autoCapitalize="none"
            />
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
    </KeyboardAvoidingView>
  );
}
