import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { limits } from '../../../../core/constants/limits';
import { Button, Input } from '../../../../shared';
import { useToast } from '../../../../shared/hooks/useToast';
import { userService } from '../../application/services';
import { ProfilePhotoUploadInput, ProfileEntity } from '../../domain/entities';

type FieldErrors = {
  firstName?: string;
  lastName?: string;
  location?: string;
  birthDate?: string;
  bio?: string;
  photo?: string;
};

interface PendingPhotoState extends ProfilePhotoUploadInput {
  fileSize: number;
  previewUri: string;
}

interface ProfileCompletionScreenProps {
  onCompleted?: (profile: ProfileEntity) => void;
  updateCurrentProfile?: typeof userService.updateCurrentProfile;
  uploadProfilePhoto?: typeof userService.uploadProfilePhoto;
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
        opacity: pressed ? 0.9 : 1,
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

function OptionalCard({
  title,
  description,
  isActive,
  onActivate,
  onSkip,
  children,
}: {
  title: string;
  description: string;
  isActive: boolean;
  onActivate: () => void;
  onSkip: () => void;
  children: React.ReactNode;
}) {
  const { colors, spacing, typography } = useAppTheme();

  if (!isActive) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${title}`}
        onPress={onActivate}
        style={({ pressed }) => ({
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          padding: spacing.md,
          gap: spacing.xs,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>{title}</Text>
        <Text style={{ color: colors.muted }}>{description}</Text>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>Add now</Text>
      </Pressable>
    );
  }

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: spacing.md,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>{title}</Text>
          <Text style={{ color: colors.muted }}>{description}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onSkip}>
          <Text style={{ color: colors.muted, fontWeight: '700' }}>Skip</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

export function ProfileCompletionScreen({
  onCompleted,
  updateCurrentProfile = userService.updateCurrentProfile,
  uploadProfilePhoto = userService.uploadProfilePhoto,
}: ProfileCompletionScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [location, setLocation] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [bio, setBio] = useState('');
  const [isLocationPublic, setIsLocationPublic] = useState(true);
  const [isBirthDatePublic, setIsBirthDatePublic] = useState(false);
  const [isPhotoPublic, setIsPhotoPublic] = useState(true);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhotoState | null>(null);
  const [showPhotoSection, setShowPhotoSection] = useState(false);
  const [showLocationSection, setShowLocationSection] = useState(false);
  const [showBirthDateSection, setShowBirthDateSection] = useState(false);
  const [showBioSection, setShowBioSection] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  const selectedOptionalCount = useMemo(
    () => [showPhotoSection, showLocationSection, showBirthDateSection, showBioSection].filter(Boolean).length,
    [showBioSection, showBirthDateSection, showLocationSection, showPhotoSection],
  );

  const clearFieldError = useCallback((field: keyof FieldErrors) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const validateForm = useCallback(
    (options?: { onlyRequired?: boolean }) => {
      const nextErrors: FieldErrors = {};

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

      if (!options?.onlyRequired || showLocationSection) {
        if (location.length > 255) {
          nextErrors.location = 'Location cannot exceed 255 characters.';
        }
      }

      if (!options?.onlyRequired || showBirthDateSection) {
        const birthDateError = validateBirthDate(birthDate);

        if (birthDateError) {
          nextErrors.birthDate = birthDateError;
        }
      }

      if (!options?.onlyRequired || showBioSection) {
        if (bio.length > 1000) {
          nextErrors.bio = 'Bio must be 1000 characters or fewer.';
        }
      }

      if (!options?.onlyRequired || showPhotoSection) {
        const photoError = validatePhoto(pendingPhoto);

        if (photoError) {
          nextErrors.photo = photoError;
        }
      }

      setFieldErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    },
    [bio.length, birthDate, firstName, lastName, location.length, pendingPhoto, showBioSection, showBirthDateSection, showLocationSection, showPhotoSection],
  );

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
    setShowPhotoSection(true);
  }, [clearFieldError]);

  const handleSkipOptionalSection = useCallback((section: 'photo' | 'location' | 'birthDate' | 'bio') => {
    setApiError(undefined);

    if (section === 'photo') {
      setPendingPhoto(null);
      setShowPhotoSection(false);
      clearFieldError('photo');
      return;
    }

    if (section === 'location') {
      setLocation('');
      setIsLocationPublic(true);
      setShowLocationSection(false);
      clearFieldError('location');
      return;
    }

    if (section === 'birthDate') {
      setBirthDate('');
      setIsBirthDatePublic(false);
      setShowBirthDateSection(false);
      clearFieldError('birthDate');
      return;
    }

    setBio('');
    setShowBioSection(false);
    clearFieldError('bio');
  }, [clearFieldError]);

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
      setFieldErrors(nextFieldErrors);
      return undefined;
    }

    return data?.message ?? data?.detail ?? (error instanceof Error ? error.message : 'Unable to save your profile.');
  }, []);

  const submit = useCallback(async (options?: { onlyRequired?: boolean }) => {
    setApiError(undefined);

    if (!validateForm(options)) {
      return;
    }

    setIsSaving(true);

    try {
      let nextProfile = await updateCurrentProfile({
        firstName,
        lastName,
        isNamePublic: true,
        location: options?.onlyRequired ? '' : showLocationSection ? location : '',
        birthDate: options?.onlyRequired ? null : showBirthDateSection ? birthDate : null,
        bio: options?.onlyRequired ? '' : showBioSection ? bio : '',
        isLocationPublic,
        isBirthDatePublic,
        isPhotoPublic,
      });

      if (!options?.onlyRequired && showPhotoSection && pendingPhoto) {
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
    showBirthDateSection,
    showBioSection,
    showLocationSection,
    showPhotoSection,
    toast,
    updateCurrentProfile,
    uploadProfilePhoto,
    validateForm,
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
              gap: spacing.md,
            }}
          >
            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: colors.muted, fontSize: typography.caption, fontWeight: '700', textTransform: 'uppercase' }}>
                Step 2 of 2
              </Text>
              <Text style={{ color: colors.text, fontSize: typography.title + 4, fontWeight: '800' }}>
                Complete your profile
              </Text>
              <Text style={{ color: colors.muted, fontSize: typography.body }}>
                Name and surname are required. Everything else is optional and can be skipped for now.
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
                flexWrap: 'wrap',
              }}
            >
              <View
                style={{
                  borderRadius: 999,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>Required: 2 fields</Text>
              </View>
              <View
                style={{
                  borderRadius: 999,
                  backgroundColor: colors.infoSurface,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  Optional sections selected: {selectedOptionalCount}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={{
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing.lg,
              gap: spacing.md,
            }}
          >
            <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
              Required details
            </Text>

            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Name</Text>
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
              <Text style={{ color: colors.text, fontWeight: '700' }}>Surname</Text>
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

          <View style={{ gap: spacing.md }}>
            <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
              Optional touches
            </Text>

            <OptionalCard
              title="Profile photo"
              description="Pick a photo so people can recognize you faster."
              isActive={showPhotoSection}
              onActivate={() => setShowPhotoSection(true)}
              onSkip={() => handleSkipOptionalSection('photo')}
            >
              {pendingPhoto ? (
                <Image
                  source={{ uri: pendingPhoto.previewUri }}
                  accessibilityLabel="Selected profile photo"
                  style={{ width: 92, height: 92, borderRadius: 24, backgroundColor: colors.infoSurface }}
                />
              ) : null}
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
            </OptionalCard>

            <OptionalCard
              title="Location"
              description="Help others understand the places that matter to you."
              isActive={showLocationSection}
              onActivate={() => setShowLocationSection(true)}
              onSkip={() => handleSkipOptionalSection('location')}
            >
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
              <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                {location.length}/255 characters
              </Text>
              <PrivacyToggle
                label="Location visibility"
                hint="Show or hide your location on your public profile."
                value={isLocationPublic}
                onToggle={() => setIsLocationPublic((current) => !current)}
              />
              {fieldErrors.location ? <Text style={{ color: colors.danger }}>{fieldErrors.location}</Text> : null}
            </OptionalCard>

            <OptionalCard
              title="Birth date"
              description="Add it now if you want it to be part of your story."
              isActive={showBirthDateSection}
              onActivate={() => setShowBirthDateSection(true)}
              onSkip={() => handleSkipOptionalSection('birthDate')}
            >
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
            </OptionalCard>

            <OptionalCard
              title="Bio"
              description="Share a short sentence about what brings you here."
              isActive={showBioSection}
              onActivate={() => setShowBioSection(true)}
              onSkip={() => handleSkipOptionalSection('bio')}
            >
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
              <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                {bio.length}/1000 characters
              </Text>
              {fieldErrors.bio ? <Text style={{ color: colors.danger }}>{fieldErrors.bio}</Text> : null}
            </OptionalCard>
          </View>

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

          <View style={{ gap: spacing.sm }}>
            <Button onPress={() => void submit()} disabled={isSaving} fullWidth>
              {isSaving ? 'Saving profile...' : 'Continue'}
            </Button>
            <Button
              variant="outline"
              onPress={() => void submit({ onlyRequired: true })}
              disabled={isSaving}
              fullWidth
            >
              Skip optional for now
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
