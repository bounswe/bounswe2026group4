import React, { useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ROUTES } from '../../../../app/navigation/routes';
import { navigationRef } from '../../../../app/navigation/navigationRef';
import { limits } from '../../../../core/constants/limits';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Button, Input } from '../../../../shared';
import { useToast } from '../../../../shared/hooks/useToast';
import {
  CreateStoryInput,
  StoryTimeType,
  SubmissionImageInput,
  submissionsService,
} from '../../application/services';
import { StoryLocationPicker } from '../components/StoryLocationPicker';

const TAG_OPTIONS = [
  { label: 'Architecture', value: 'architecture' },
  { label: 'War', value: 'war' },
  { label: 'Culture', value: 'culture' },
  { label: 'Trade', value: 'trade' },
  { label: 'Religion', value: 'religion' },
  { label: 'Daily Life', value: 'daily-life' },
  { label: 'Art', value: 'art' },
  { label: 'Politics', value: 'politics' },
] as const;

const TIME_TYPES: Array<{ value: StoryTimeType; label: string; helper: string }> = [
  { value: 'exact_year', label: 'Exact Year', helper: 'Use a specific known year.' },
  { value: 'approximate_year', label: 'Approximate', helper: 'For estimated years like circa 1450.' },
  { value: 'decade', label: 'Decade', helper: 'Enter the decade base year like 1980.' },
  { value: 'year_range', label: 'Year Range', helper: 'Capture stories that span multiple years.' },
];

type FieldName =
  | 'title'
  | 'narrative'
  | 'location'
  | 'placeName'
  | 'year'
  | 'yearStart'
  | 'yearEnd'
  | 'tags'
  | 'image';

type LayoutTargetName = FieldName | 'time';

const FIELD_SCROLL_ORDER: FieldName[] = [
  'title',
  'narrative',
  'location',
  'placeName',
  'year',
  'yearStart',
  'yearEnd',
  'tags',
  'image',
];

interface SubmissionFormState {
  title: string;
  narrative: string;
  latitude: number | null;
  longitude: number | null;
  placeName: string;
  timeType: StoryTimeType;
  year: string;
  yearStart: string;
  yearEnd: string;
  selectedTags: string[];
  customTag: string;
  image: (SubmissionImageInput & { fileSize?: number | null }) | null;
  imagePreviewUri: string | null;
  isSubmitting: boolean;
  apiError?: string;
}

const initialState: SubmissionFormState = {
  title: '',
  narrative: '',
  latitude: null,
  longitude: null,
  placeName: '',
  timeType: 'exact_year',
  year: '',
  yearStart: '',
  yearEnd: '',
  selectedTags: [],
  customTag: '',
  image: null,
  imagePreviewUri: null,
  isSubmitting: false,
};

function normalizeTagName(tag: string) {
  return tag.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

function inferMimeType(uri: string) {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.png')) {
    return 'image/png';
  }
  return 'image/jpeg';
}

function isValidImageType(mimeType: string) {
  return mimeType === 'image/jpeg' || mimeType === 'image/png';
}

function buildFieldLabel(tag: string) {
  return tag
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function SubmissionScreen() {
  const { colors, spacing, typography } = useAppTheme();
  const { toast } = useToast();
  const scrollViewRef = useRef<ScrollView>(null);
  const fieldPositionsRef = useRef<Partial<Record<LayoutTargetName, { y: number; parent?: LayoutTargetName }>>>({});
  const [state, setState] = useState<SubmissionFormState>(initialState);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});

  const selectedTimeType = useMemo(
    () => TIME_TYPES.find((timeType) => timeType.value === state.timeType) ?? TIME_TYPES[0],
    [state.timeType],
  );

  const updateField = <K extends keyof SubmissionFormState>(field: K, value: SubmissionFormState[K]) => {
    setState((current) => ({ ...current, [field]: value, apiError: undefined }));
  };

  const clearFieldError = (field: FieldName) => {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      return {
        ...current,
        [field]: undefined,
      };
    });
  };

  const registerFieldLayout = (field: LayoutTargetName, parent?: LayoutTargetName) => (event: LayoutChangeEvent) => {
    fieldPositionsRef.current[field] = { y: event.nativeEvent.layout.y, parent };
  };

  const getInputShellStyle = (field: FieldName) => ({
    borderColor: fieldErrors[field] ? colors.danger : colors.border,
  });

  const scrollToFirstError = (errors: Partial<Record<FieldName, string>>) => {
    const firstInvalidField = FIELD_SCROLL_ORDER.find((field) => errors[field]);

    if (!firstInvalidField) {
      return;
    }

    let fieldY = 0;
    let layoutTarget: LayoutTargetName | undefined = firstInvalidField;

    while (layoutTarget) {
      const position: { y: number; parent?: LayoutTargetName } | undefined = fieldPositionsRef.current[layoutTarget];

      if (!position) {
        break;
      }

      fieldY += position.y;
      layoutTarget = position.parent;
    }

    scrollViewRef.current?.scrollTo({
      y: Math.max(fieldY - spacing.md, 0),
      animated: true,
    });
  };

  const validate = () => {
    const nextErrors: Partial<Record<FieldName, string>> = {};

    if (!state.title.trim()) {
      nextErrors.title = 'Title is required.';
    }
    if (!state.narrative.trim()) {
      nextErrors.narrative = 'Narrative text is required.';
    }
    if (!state.placeName.trim()) {
      nextErrors.placeName = 'Place name is required.';
    }
    if (state.latitude == null || state.longitude == null) {
      nextErrors.location = 'Select a story location on the map.';
    }
    if (state.selectedTags.length > limits.maxTagsPerStory) {
      nextErrors.tags = `Choose up to ${limits.maxTagsPerStory} tags.`;
    }

    if (state.timeType === 'year_range') {
      if (!state.yearStart.trim()) {
        nextErrors.yearStart = 'Start year is required.';
      } else if (Number.isNaN(Number(state.yearStart))) {
        nextErrors.yearStart = 'Start year must be a number.';
      }

      if (!state.yearEnd.trim()) {
        nextErrors.yearEnd = 'End year is required.';
      } else if (Number.isNaN(Number(state.yearEnd))) {
        nextErrors.yearEnd = 'End year must be a number.';
      }

      if (!nextErrors.yearStart && !nextErrors.yearEnd && Number(state.yearStart) >= Number(state.yearEnd)) {
        nextErrors.yearStart = 'Start year must be earlier than end year.';
      }
    } else if (!state.year.trim()) {
      nextErrors.year = 'Year is required.';
    } else if (Number.isNaN(Number(state.year))) {
      nextErrors.year = 'Year must be a number.';
    }

    if (state.image) {
      if (!isValidImageType(state.image.type)) {
        nextErrors.image = 'Only JPG and PNG images are allowed.';
      } else if ((state.image.fileSize ?? 0) > limits.maxStoryImageBytes) {
        nextErrors.image = 'Image must be smaller than 2MB.';
      }
    }

    setFieldErrors(nextErrors);
    scrollToFirstError(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const addTag = () => {
    const normalizedTag = normalizeTagName(state.customTag);

    if (!normalizedTag) {
      setFieldErrors((current) => ({ ...current, tags: 'Enter a tag name first.' }));
      return;
    }

    if (state.selectedTags.includes(normalizedTag)) {
      updateField('customTag', '');
      clearFieldError('tags');
      return;
    }

    if (state.selectedTags.length >= limits.maxTagsPerStory) {
      setFieldErrors((current) => ({
        ...current,
        tags: `You can choose up to ${limits.maxTagsPerStory} tags.`,
      }));
      return;
    }

    updateField('selectedTags', [...state.selectedTags, normalizedTag]);
    updateField('customTag', '');
    clearFieldError('tags');
  };

  const toggleTag = (tag: string) => {
    const isSelected = state.selectedTags.includes(tag);

    if (isSelected) {
      updateField(
        'selectedTags',
        state.selectedTags.filter((selectedTag) => selectedTag !== tag),
      );
      clearFieldError('tags');
      return;
    }

    if (state.selectedTags.length >= limits.maxTagsPerStory) {
      setFieldErrors((current) => ({
        ...current,
        tags: `You can choose up to ${limits.maxTagsPerStory} tags.`,
      }));
      return;
    }

    updateField('selectedTags', [...state.selectedTags, tag]);
    clearFieldError('tags');
  };

  const applyPickedAsset = (asset: ImagePicker.ImagePickerAsset) => {
    const mimeType = asset.mimeType ?? inferMimeType(asset.uri);
    const image = {
      uri: asset.uri,
      name: asset.fileName ?? `story-image.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
      type: mimeType,
      fileSize: asset.fileSize,
    };

    updateField('image', image);
    updateField('imagePreviewUri', asset.uri);

    if (!isValidImageType(mimeType)) {
      setFieldErrors((current) => ({ ...current, image: 'Only JPG and PNG images are allowed.' }));
      return false;
    }

    if ((asset.fileSize ?? 0) > limits.maxStoryImageBytes) {
      setFieldErrors((current) => ({ ...current, image: 'Image must be smaller than 2MB.' }));
      return false;
    }

    clearFieldError('image');
    return true;
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setFieldErrors((current) => ({ ...current, image: 'Photo library permission is required.' }));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled) {
      applyPickedAsset(result.assets[0]);
    }
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      setFieldErrors((current) => ({ ...current, image: 'Camera permission is required.' }));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled) {
      applyPickedAsset(result.assets[0]);
    }
  };

  const removeImage = () => {
    updateField('image', null);
    updateField('imagePreviewUri', null);
    clearFieldError('image');
  };

  const submit = async () => {
    if (state.isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    setState((current) => ({ ...current, isSubmitting: true, apiError: undefined }));

    const payload: CreateStoryInput = {
      title: state.title.trim(),
      narrative: state.narrative.trim(),
      location: {
        latitude: state.latitude ?? 0,
        longitude: state.longitude ?? 0,
      },
      placeName: state.placeName.trim(),
      timeType: state.timeType,
      tags: state.selectedTags,
      image: state.image,
    };

    if (state.timeType === 'year_range') {
      payload.yearStart = Number(state.yearStart);
      payload.yearEnd = Number(state.yearEnd);
    } else {
      payload.year = Number(state.year);
    }

    try {
      await submissionsService.createStory(payload);
      toast.success('Story submitted successfully.');
      setState(initialState);
      navigationRef.navigate?.(ROUTES.FEED);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit story.';
      setState((current) => ({
        ...current,
        isSubmitting: false,
        apiError: message,
      }));
      toast.error(message);
      return;
    }

    setState(initialState);
  };

  return (
    <View style={{ width: '100%' }}>
      <ScrollView
        ref={scrollViewRef}
        testID="submission-scroll-view"
        style={{ width: '100%' }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}
      >
        <View
          style={{
            padding: spacing.md,
            borderRadius: 20,
            backgroundColor: colors.infoSurface,
            gap: spacing.xs,
          }}
        >
          <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
            Share a place-bound story
          </Text>
          <Text style={{ color: colors.muted }}>
            Match the web flow: add the title, narrative, map pin, place name, time details, tags,
            and an optional image before publishing.
          </Text>
        </View>

        {state.apiError ? (
          <View
            style={{
              padding: spacing.md,
              borderRadius: 16,
              backgroundColor: colors.dangerSurface,
              borderWidth: 1,
              borderColor: colors.danger,
            }}
          >
            <Text style={{ color: colors.danger, fontWeight: '700' }}>Submission failed</Text>
            <Text style={{ marginTop: spacing.xs, color: colors.danger }}>{state.apiError}</Text>
          </View>
        ) : null}

        <View testID="submission-field-title" onLayout={registerFieldLayout('title')} style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Title</Text>
          <Input
            value={state.title}
            onChangeText={(value) => {
              updateField('title', value);
              clearFieldError('title');
            }}
            placeholder="Enter a story title"
            editable={!state.isSubmitting}
            accessibilityLabel="Story title"
            style={getInputShellStyle('title')}
          />
          {fieldErrors.title ? <Text style={{ color: colors.danger }}>{fieldErrors.title}</Text> : null}
        </View>

        <View testID="submission-field-narrative" onLayout={registerFieldLayout('narrative')} style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Narrative text</Text>
          <TextInput
            value={state.narrative}
            onChangeText={(value) => {
              updateField('narrative', value);
              clearFieldError('narrative');
            }}
            placeholder="Tell the historical story..."
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
            editable={!state.isSubmitting}
            accessibilityLabel="Story narrative"
            style={{
              minHeight: 160,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: fieldErrors.narrative ? colors.danger : colors.border,
              backgroundColor: colors.surface,
              color: colors.text,
              fontSize: typography.body,
            }}
          />
          {fieldErrors.narrative ? <Text style={{ color: colors.danger }}>{fieldErrors.narrative}</Text> : null}
        </View>

        <View testID="submission-field-location" onLayout={registerFieldLayout('location')} style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Location picker</Text>
          <StoryLocationPicker
            latitude={state.latitude}
            longitude={state.longitude}
            onChange={(coords) => {
              updateField('latitude', coords.latitude);
              updateField('longitude', coords.longitude);
              clearFieldError('location');
            }}
            error={fieldErrors.location}
          />
        </View>

        <View testID="submission-field-place-name" onLayout={registerFieldLayout('placeName')} style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Place name</Text>
          <Input
            value={state.placeName}
            onChangeText={(value) => {
              updateField('placeName', value);
              clearFieldError('placeName');
            }}
            placeholder="e.g. Hagia Sophia"
            editable={!state.isSubmitting}
            autoCapitalize="words"
            accessibilityLabel="Place name"
            style={getInputShellStyle('placeName')}
          />
          {fieldErrors.placeName ? <Text style={{ color: colors.danger }}>{fieldErrors.placeName}</Text> : null}
        </View>

        <View testID="submission-field-time" onLayout={registerFieldLayout('time')} style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Time information</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {TIME_TYPES.map((timeType) => {
              const active = timeType.value === state.timeType;
              return (
                <Pressable
                  key={timeType.value}
                  onPress={() => {
                    updateField('timeType', timeType.value);
                    clearFieldError('year');
                    clearFieldError('yearStart');
                    clearFieldError('yearEnd');
                  }}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm + 2,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.surface,
                  }}
                >
                  <Text style={{ color: active ? colors.background : colors.text, fontWeight: '700' }}>
                    {timeType.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={{ color: colors.muted }}>{selectedTimeType.helper}</Text>

          {state.timeType === 'year_range' ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View
                testID="submission-field-year-start"
                onLayout={registerFieldLayout('yearStart', 'time')}
                style={{ flex: 1, gap: spacing.sm }}
              >
                <Input
                  value={state.yearStart}
                  onChangeText={(value) => {
                    updateField('yearStart', value);
                    clearFieldError('yearStart');
                  }}
                  placeholder="Start year"
                  keyboardType="numeric"
                  editable={!state.isSubmitting}
                  accessibilityLabel="Start year"
                  style={getInputShellStyle('yearStart')}
                />
                {fieldErrors.yearStart ? <Text style={{ color: colors.danger }}>{fieldErrors.yearStart}</Text> : null}
              </View>
              <View
                testID="submission-field-year-end"
                onLayout={registerFieldLayout('yearEnd', 'time')}
                style={{ flex: 1, gap: spacing.sm }}
              >
                <Input
                  value={state.yearEnd}
                  onChangeText={(value) => {
                    updateField('yearEnd', value);
                    clearFieldError('yearEnd');
                  }}
                  placeholder="End year"
                  keyboardType="numeric"
                  editable={!state.isSubmitting}
                  accessibilityLabel="End year"
                  style={getInputShellStyle('yearEnd')}
                />
                {fieldErrors.yearEnd ? <Text style={{ color: colors.danger }}>{fieldErrors.yearEnd}</Text> : null}
              </View>
            </View>
          ) : (
            <View testID="submission-field-year" onLayout={registerFieldLayout('year', 'time')} style={{ gap: spacing.sm }}>
              <Input
                value={state.year}
                onChangeText={(value) => {
                  updateField('year', value);
                  clearFieldError('year');
                }}
                placeholder={state.timeType === 'decade' ? 'e.g. 1980' : 'e.g. 1453'}
                keyboardType="numeric"
                editable={!state.isSubmitting}
                accessibilityLabel="Year"
                style={getInputShellStyle('year')}
              />
              {fieldErrors.year ? <Text style={{ color: colors.danger }}>{fieldErrors.year}</Text> : null}
            </View>
          )}
        </View>

        <View testID="submission-field-tags" onLayout={registerFieldLayout('tags')} style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            Tags (up to {limits.maxTagsPerStory})
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {TAG_OPTIONS.map((tag) => {
              const active = state.selectedTags.includes(tag.value);
              return (
                <Pressable
                  key={tag.value}
                  onPress={() => toggleTag(tag.value)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.infoSurface : colors.surface,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: active ? '700' : '500' }}>{tag.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Input
                value={state.customTag}
                onChangeText={(value) => {
                  updateField('customTag', value);
                  clearFieldError('tags');
                }}
                placeholder="Create a new tag"
                editable={!state.isSubmitting}
                autoCapitalize="none"
                accessibilityLabel="Custom tag"
              />
            </View>
            <Button onPress={addTag} disabled={state.isSubmitting}>
              Add tag
            </Button>
          </View>
          {state.selectedTags.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {state.selectedTags.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: 999,
                    backgroundColor: colors.primary,
                  }}
                >
                  <Text style={{ color: colors.background, fontWeight: '700' }}>
                    {buildFieldLabel(tag)} x
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {fieldErrors.tags ? <Text style={{ color: colors.danger }}>{fieldErrors.tags}</Text> : null}
        </View>

        <View testID="submission-field-image" onLayout={registerFieldLayout('image')} style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Image upload</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button onPress={handlePickImage} disabled={state.isSubmitting}>
              Choose image
            </Button>
            <Button onPress={handleTakePhoto} disabled={state.isSubmitting}>
              Use camera
            </Button>
          </View>
          <Text style={{ color: colors.muted }}>
            JPG or PNG only, maximum 2MB.
          </Text>
          {state.imagePreviewUri ? (
            <View style={{ gap: spacing.sm }}>
              <Image
                source={{ uri: state.imagePreviewUri }}
                accessibilityLabel="Selected story image preview"
                style={{ width: '100%', height: 220, borderRadius: 20, backgroundColor: colors.surface }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.text }}>{state.image?.name ?? 'Selected image'}</Text>
                <Pressable onPress={removeImage}>
                  <Text style={{ color: colors.danger, fontWeight: '700' }}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {fieldErrors.image ? <Text style={{ color: colors.danger }}>{fieldErrors.image}</Text> : null}
        </View>

        <Button onPress={submit} disabled={state.isSubmitting} fullWidth>
          {state.isSubmitting ? 'Submitting story...' : 'Submit story'}
        </Button>
      </ScrollView>
    </View>
  );
}
