import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Pause, Play, Volume2 } from 'lucide-react-native';
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
  SubmissionMediaInput,
  submissionsService,
} from '../../application/services';
import { buildDateValueFromParts, buildEdtfTemporalCoverage, normalizeTimeValue } from '../../application/services/temporal';
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

const MAX_STORY_YEAR = 2026;

const TIME_TYPES: Array<{ value: StoryTimeType; label: string; accessibilityLabel: string; helper: string }> = [
  { value: 'exact_year', label: 'Exact', accessibilityLabel: 'Exact Year', helper: 'Use a specific known year.' },
  { value: 'approximate_year', label: 'Approx', accessibilityLabel: 'Approximate Year', helper: 'For estimated years like circa 1450.' },
  { value: 'decade', label: 'Decade', accessibilityLabel: 'Decade', helper: 'Enter the decade base year like 1980.' },
  { value: 'year_range', label: 'Range', accessibilityLabel: 'Year Range', helper: 'Capture stories that span multiple years.' },
  { value: 'exact_date', label: 'Date', accessibilityLabel: 'Specific Date', helper: 'Use a day, month, and year. Time is optional.' },
];

type FieldName =
  | 'title'
  | 'narrative'
  | 'location'
  | 'placeName'
  | 'year'
  | 'yearStart'
  | 'yearEnd'
  | 'dateDay'
  | 'dateMonth'
  | 'dateYear'
  | 'timeValue'
  | 'tags'
  | 'image'
  | 'audio'
  | 'video';

type LayoutTargetName = FieldName | 'time';

const FIELD_SCROLL_ORDER: FieldName[] = [
  'title',
  'narrative',
  'location',
  'placeName',
  'year',
  'yearStart',
  'yearEnd',
  'dateDay',
  'dateMonth',
  'dateYear',
  'timeValue',
  'tags',
  'image',
  'audio',
  'video',
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
  dateDay: string;
  dateMonth: string;
  dateYear: string;
  timeValue: string;
  selectedTags: string[];
  customTag: string;
  image: (SubmissionImageInput & { fileSize?: number | null }) | null;
  imagePreviewUri: string | null;
  audio: (SubmissionMediaInput & { fileSize?: number | null }) | null;
  video: (SubmissionMediaInput & { fileSize?: number | null }) | null;
  contributorVisible: boolean;
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
  dateDay: '',
  dateMonth: '',
  dateYear: '',
  timeValue: '',
  selectedTags: [],
  customTag: '',
  image: null,
  imagePreviewUri: null,
  audio: null,
  video: null,
  contributorVisible: true,
  isSubmitting: false,
};

function normalizeTagName(tag: string) {
  return tag.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

function normalizeYearInput(value: string, allowNegative = true) {
  const trimmedValue = value.trim();
  const isNegative = allowNegative && trimmedValue.startsWith('-');
  const digitsOnly = trimmedValue.replace(/[^0-9]/g, '').slice(0, 4);
  const numericValue = Number(digitsOnly);

  if (digitsOnly.length === 4 && Number.isFinite(numericValue) && numericValue > MAX_STORY_YEAR) {
    return isNegative ? `-${digitsOnly}` : String(MAX_STORY_YEAR);
  }

  return `${isNegative ? '-' : ''}${digitsOnly}`;
}

function isYearAfterLimit(value: string) {
  return Number(value) > MAX_STORY_YEAR;
}

function inferMimeType(uri: string) {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.png')) {
    return 'image/png';
  }
  return 'image/jpeg';
}

function inferAudioMimeType(nameOrUri: string) {
  const normalized = nameOrUri.toLowerCase();
  if (normalized.endsWith('.wav')) {
    return 'audio/wav';
  }
  if (normalized.endsWith('.ogg')) {
    return 'audio/ogg';
  }
  return 'audio/mpeg';
}

function inferVideoMimeType(nameOrUri: string) {
  const normalized = nameOrUri.toLowerCase();
  if (normalized.endsWith('.webm')) {
    return 'video/webm';
  }
  return 'video/mp4';
}

function isValidImageType(mimeType: string) {
  return mimeType === 'image/jpeg' || mimeType === 'image/png';
}

function isValidAudioType(mimeType: string) {
  return (
    mimeType === 'audio/mpeg' ||
    mimeType === 'audio/mp3' ||
    mimeType === 'audio/wav' ||
    mimeType === 'audio/x-wav' ||
    mimeType === 'audio/ogg'
  );
}

function isValidVideoType(mimeType: string) {
  return mimeType === 'video/mp4' || mimeType === 'video/webm';
}

function buildFieldLabel(tag: string) {
  return tag
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPlaybackTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function AudioPlaybackPreview({ uri, label, title }: { uri: string; label: string; title: string }) {
  const { colors, spacing, typography } = useAppTheme();
  const player = useAudioPlayer({ uri }, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [scrubTime, setScrubTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [pendingSeekTime, setPendingSeekTime] = useState<number | null>(null);
  const shouldResumeAfterScrubRef = useRef(false);
  const duration = status.duration || 0;
  const displayedTime = isScrubbing ? scrubTime : pendingSeekTime ?? status.currentTime;

  useEffect(() => {
    if (pendingSeekTime == null) {
      return;
    }

    if (Math.abs(status.currentTime - pendingSeekTime) < 0.35) {
      setPendingSeekTime(null);
    }
  }, [pendingSeekTime, status.currentTime]);

  const togglePlayback = () => {
    if (status.playing) {
      player.pause();
      return;
    }

    if (status.didJustFinish) {
      void player.seekTo(0);
    }
    player.play();
  };

  return (
    <View
      accessibilityLabel={label}
      style={{
        minHeight: 150,
        borderRadius: 18,
        backgroundColor: '#111827',
        padding: spacing.md,
        justifyContent: 'space-between',
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={status.playing ? 'Pause audio preview' : 'Play audio preview'}
          onPress={togglePlayback}
          style={({ pressed }) => ({
            width: 58,
            height: 58,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.background,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {status.playing ? (
            <Pause size={26} color="#111827" fill="#111827" />
          ) : (
            <Play size={26} color="#111827" fill="#111827" style={{ marginLeft: 2 }} />
          )}
        </Pressable>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text numberOfLines={1} style={{ color: colors.background, fontSize: typography.body, fontWeight: '800' }}>
            {title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Volume2 size={16} color="#cbd5e1" />
            <Text style={{ color: '#cbd5e1', fontSize: typography.caption, fontWeight: '600' }}>
              Audio preview
            </Text>
          </View>
        </View>
      </View>
      <View style={{ gap: spacing.xs }}>
        <Slider
          accessibilityLabel="Seek audio preview"
          disabled={duration <= 0}
          minimumValue={0}
          maximumValue={Math.max(duration, 0)}
          value={Math.min(displayedTime, duration || displayedTime)}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor="#334155"
          thumbTintColor={colors.background}
          tapToSeek
          onSlidingStart={(value) => {
            setPendingSeekTime(null);
            shouldResumeAfterScrubRef.current = status.playing;
            if (status.playing) {
              player.pause();
            }
            setIsScrubbing(true);
            setScrubTime(value);
          }}
          onValueChange={(value) => {
            setScrubTime(value);
          }}
          onSlidingComplete={(value) => {
            setScrubTime(value);
            setIsScrubbing(false);
            if (duration > 0) {
              setPendingSeekTime(value);
              void player.seekTo(value).then(() => {
                if (shouldResumeAfterScrubRef.current) {
                  player.play();
                }
                shouldResumeAfterScrubRef.current = false;
              });
              return;
            }
            setPendingSeekTime(null);
            shouldResumeAfterScrubRef.current = false;
          }}
          style={{
            width: '100%',
            height: 36,
          }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: '#cbd5e1', fontSize: typography.caption, fontWeight: '700' }}>
            {formatPlaybackTime(displayedTime)}
          </Text>
          <Text style={{ color: '#cbd5e1', fontSize: typography.caption, fontWeight: '700' }}>
            {status.isLoaded && duration > 0 ? formatPlaybackTime(duration) : '--:--'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function VideoPlaybackPreview({ uri, label }: { uri: string; label: string }) {
  const player = useVideoPlayer({ uri });

  return (
    <VideoView
      accessibilityLabel={label}
      player={player}
      nativeControls
      contentFit="contain"
      allowsFullscreen
      style={{
        height: 280,
        width: '100%',
        borderRadius: 16,
        backgroundColor: '#111827',
      }}
    />
  );
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

    if (state.timeType === 'exact_date') {
      const hasDay = Boolean(state.dateDay.trim());
      const hasMonth = Boolean(state.dateMonth.trim());
      const hasYear = Boolean(state.dateYear.trim());

      if (!hasDay) {
        nextErrors.dateDay = 'Day is required.';
      }
      if (!hasMonth) {
        nextErrors.dateMonth = 'Month is required.';
      }
      if (!hasYear) {
        nextErrors.dateYear = 'Year is required.';
      } else if (Number.isNaN(Number(state.dateYear))) {
        nextErrors.dateYear = 'Year must be a number.';
      } else if (isYearAfterLimit(state.dateYear)) {
        nextErrors.dateYear = `Year cannot be later than ${MAX_STORY_YEAR}.`;
      }

      if (
        hasDay &&
        hasMonth &&
        hasYear &&
        !nextErrors.dateYear &&
        !buildDateValueFromParts(state.dateDay, state.dateMonth, state.dateYear)
      ) {
        nextErrors.dateDay = 'Enter a valid calendar date.';
      }

      if (state.timeValue.trim() && !normalizeTimeValue(state.timeValue)) {
        nextErrors.timeValue = 'Time must use 24-hour HH:MM format.';
      }
    } else if (state.timeType === 'year_range') {
      if (!state.yearStart.trim()) {
        nextErrors.yearStart = 'Start year is required.';
      } else if (Number.isNaN(Number(state.yearStart))) {
        nextErrors.yearStart = 'Start year must be a number.';
      } else if (isYearAfterLimit(state.yearStart)) {
        nextErrors.yearStart = `Start year cannot be later than ${MAX_STORY_YEAR}.`;
      }

      if (!state.yearEnd.trim()) {
        nextErrors.yearEnd = 'End year is required.';
      } else if (Number.isNaN(Number(state.yearEnd))) {
        nextErrors.yearEnd = 'End year must be a number.';
      } else if (isYearAfterLimit(state.yearEnd)) {
        nextErrors.yearEnd = `End year cannot be later than ${MAX_STORY_YEAR}.`;
      }

      if (!nextErrors.yearStart && !nextErrors.yearEnd && Number(state.yearStart) >= Number(state.yearEnd)) {
        nextErrors.yearStart = 'Start year must be earlier than end year.';
      }
    } else if (!state.year.trim()) {
      nextErrors.year = 'Year is required.';
    } else if (Number.isNaN(Number(state.year))) {
      nextErrors.year = 'Year must be a number.';
    } else if (isYearAfterLimit(state.year)) {
      nextErrors.year = `Year cannot be later than ${MAX_STORY_YEAR}.`;
    }

    if (state.image) {
      if (!isValidImageType(state.image.type)) {
        nextErrors.image = 'Only JPG and PNG images are allowed.';
      } else if ((state.image.fileSize ?? 0) > limits.maxStoryImageBytes) {
        nextErrors.image = 'Image must be smaller than 2MB.';
      }
    }

    if (state.audio) {
      if (!isValidAudioType(state.audio.type)) {
        nextErrors.audio = 'Only MP3, WAV, and OGG audio files are allowed.';
      } else if ((state.audio.fileSize ?? 0) > limits.maxStoryAudioBytes) {
        nextErrors.audio = 'Audio must be smaller than 10MB.';
      }
    }

    if (state.video) {
      if (!isValidVideoType(state.video.type)) {
        nextErrors.video = 'Only MP4 and WEBM videos are allowed.';
      } else if ((state.video.fileSize ?? 0) > limits.maxStoryVideoBytes) {
        nextErrors.video = 'Video must be smaller than 50MB.';
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

  const applyPickedAudio = (asset: DocumentPicker.DocumentPickerAsset) => {
    const mimeType = asset.mimeType ?? inferAudioMimeType(asset.name || asset.uri);
    const audio = {
      uri: asset.uri,
      name: asset.name || 'story-audio.mp3',
      type: mimeType,
      mediaType: 'audio' as const,
      fileSize: asset.size,
    };

    updateField('audio', audio);

    if (!isValidAudioType(mimeType)) {
      setFieldErrors((current) => ({ ...current, audio: 'Only MP3, WAV, and OGG audio files are allowed.' }));
      return false;
    }

    if ((asset.size ?? 0) > limits.maxStoryAudioBytes) {
      setFieldErrors((current) => ({ ...current, audio: 'Audio must be smaller than 10MB.' }));
      return false;
    }

    clearFieldError('audio');
    return true;
  };

  const handlePickAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (!result.canceled) {
      applyPickedAudio(result.assets[0]);
    }
  };

  const removeAudio = () => {
    updateField('audio', null);
    clearFieldError('audio');
  };

  const applyPickedVideo = (asset: ImagePicker.ImagePickerAsset) => {
    const mimeType = asset.mimeType ?? inferVideoMimeType(asset.fileName ?? asset.uri);
    const video = {
      uri: asset.uri,
      name: asset.fileName ?? `story-video.${mimeType === 'video/webm' ? 'webm' : 'mp4'}`,
      type: mimeType,
      mediaType: 'video' as const,
      fileSize: asset.fileSize,
    };

    updateField('video', video);

    if (!isValidVideoType(mimeType)) {
      setFieldErrors((current) => ({ ...current, video: 'Only MP4 and WEBM videos are allowed.' }));
      return false;
    }

    if ((asset.fileSize ?? 0) > limits.maxStoryVideoBytes) {
      setFieldErrors((current) => ({ ...current, video: 'Video must be smaller than 50MB.' }));
      return false;
    }

    clearFieldError('video');
    return true;
  };

  const handlePickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setFieldErrors((current) => ({ ...current, video: 'Photo library permission is required.' }));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled) {
      applyPickedVideo(result.assets[0]);
    }
  };

  const removeVideo = () => {
    updateField('video', null);
    clearFieldError('video');
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
      audio: state.audio,
      video: state.video,
      contributorVisible: state.contributorVisible,
    };

    if (state.timeType === 'exact_date') {
      const dateValue = buildDateValueFromParts(state.dateDay, state.dateMonth, state.dateYear);
      const timeValue = normalizeTimeValue(state.timeValue);

      payload.dateValue = dateValue;
      payload.timeValue = timeValue;
      payload.temporalCoverage = buildEdtfTemporalCoverage({
        timeType: state.timeType,
        dateValue,
        timeValue,
      });
    } else if (state.timeType === 'year_range') {
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
            optional media, and visibility before publishing.
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
          <View
            testID="submission-time-type-options"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}
          >
            {TIME_TYPES.map((timeType) => {
              const active = timeType.value === state.timeType;
              return (
                <Pressable
                  key={timeType.value}
                  accessibilityRole="button"
                  accessibilityLabel={timeType.accessibilityLabel}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    updateField('timeType', timeType.value);
                    clearFieldError('year');
                    clearFieldError('yearStart');
                    clearFieldError('yearEnd');
                    clearFieldError('dateDay');
                    clearFieldError('dateMonth');
                    clearFieldError('dateYear');
                    clearFieldError('timeValue');
                  }}
                  style={{
                    flexBasis: 88,
                    flexGrow: 1,
                    minHeight: 38,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs + 2,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.infoSurface,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    style={{ color: active ? colors.background : colors.text, fontWeight: '800', fontSize: 13 }}
                  >
                    {timeType.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: colors.muted }}>{selectedTimeType.helper}</Text>

          {state.timeType === 'exact_date' ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View
                  testID="submission-field-date-day"
                  onLayout={registerFieldLayout('dateDay', 'time')}
                  style={{ flex: 1, gap: spacing.sm }}
                >
                  <Input
                    value={state.dateDay}
                    onChangeText={(value) => {
                      updateField('dateDay', value.replace(/[^0-9]/g, '').slice(0, 2));
                      clearFieldError('dateDay');
                    }}
                    placeholder="DD"
                    keyboardType="numeric"
                    editable={!state.isSubmitting}
                    accessibilityLabel="Specific date day"
                    style={getInputShellStyle('dateDay')}
                  />
                  {fieldErrors.dateDay ? <Text style={{ color: colors.danger }}>{fieldErrors.dateDay}</Text> : null}
                </View>
                <View
                  testID="submission-field-date-month"
                  onLayout={registerFieldLayout('dateMonth', 'time')}
                  style={{ flex: 1, gap: spacing.sm }}
                >
                  <Input
                    value={state.dateMonth}
                    onChangeText={(value) => {
                      updateField('dateMonth', value.replace(/[^0-9]/g, '').slice(0, 2));
                      clearFieldError('dateMonth');
                    }}
                    placeholder="MM"
                    keyboardType="numeric"
                    editable={!state.isSubmitting}
                    accessibilityLabel="Specific date month"
                    style={getInputShellStyle('dateMonth')}
                  />
                  {fieldErrors.dateMonth ? <Text style={{ color: colors.danger }}>{fieldErrors.dateMonth}</Text> : null}
                </View>
                <View
                  testID="submission-field-date-year"
                  onLayout={registerFieldLayout('dateYear', 'time')}
                  style={{ flex: 1.4, gap: spacing.sm }}
                >
                  <Input
                    value={state.dateYear}
                    onChangeText={(value) => {
                      updateField('dateYear', normalizeYearInput(value, false));
                      clearFieldError('dateYear');
                    }}
                    placeholder="YYYY"
                    keyboardType="numeric"
                    editable={!state.isSubmitting}
                    accessibilityLabel="Specific date year"
                    style={getInputShellStyle('dateYear')}
                  />
                  {fieldErrors.dateYear ? <Text style={{ color: colors.danger }}>{fieldErrors.dateYear}</Text> : null}
                </View>
              </View>
              <View
                testID="submission-field-time-value"
                onLayout={registerFieldLayout('timeValue', 'time')}
                style={{ gap: spacing.sm }}
              >
                <Input
                  value={state.timeValue}
                  onChangeText={(value) => {
                    updateField('timeValue', value.replace(/[^0-9:]/g, '').slice(0, 5));
                    clearFieldError('timeValue');
                  }}
                  placeholder="Optional time, e.g. 09:30"
                  editable={!state.isSubmitting}
                  accessibilityLabel="Optional specific time"
                  style={getInputShellStyle('timeValue')}
                />
                {fieldErrors.timeValue ? <Text style={{ color: colors.danger }}>{fieldErrors.timeValue}</Text> : null}
              </View>
            </View>
          ) : state.timeType === 'year_range' ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View
                testID="submission-field-year-start"
                onLayout={registerFieldLayout('yearStart', 'time')}
                style={{ flex: 1, gap: spacing.sm }}
              >
                <Input
                  value={state.yearStart}
                  onChangeText={(value) => {
                    updateField('yearStart', normalizeYearInput(value));
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
                    updateField('yearEnd', normalizeYearInput(value));
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
                  updateField('year', normalizeYearInput(value));
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

        <View testID="submission-field-audio" onLayout={registerFieldLayout('audio')} style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Audio upload</Text>
          <Button onPress={handlePickAudio} disabled={state.isSubmitting}>
            Choose audio
          </Button>
          <Text style={{ color: colors.muted }}>
            MP3, WAV, or OGG only, maximum 10MB.
          </Text>
          {state.audio ? (
            <View
              style={{
                padding: spacing.sm,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                shadowColor: '#000000',
                shadowOpacity: 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 2,
                gap: spacing.sm,
              }}
            >
              <AudioPlaybackPreview
                uri={state.audio.uri}
                label="Selected story audio preview"
                title={state.audio.name}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
                <Text numberOfLines={2} style={{ color: colors.text, flex: 1 }}>
                  Selected audio
                </Text>
                <Pressable onPress={removeAudio} accessibilityLabel="Remove audio">
                  <Text style={{ color: colors.danger, fontWeight: '700' }}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {fieldErrors.audio ? <Text style={{ color: colors.danger }}>{fieldErrors.audio}</Text> : null}
        </View>

        <View testID="submission-field-video" onLayout={registerFieldLayout('video')} style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Video upload</Text>
          <Button onPress={handlePickVideo} disabled={state.isSubmitting}>
            Choose video
          </Button>
          <Text style={{ color: colors.muted }}>
            MP4 or WEBM only, maximum 50MB.
          </Text>
          {state.video ? (
            <View
              style={{
                padding: spacing.sm,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                shadowColor: '#000000',
                shadowOpacity: 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 2,
                gap: spacing.sm,
              }}
            >
              <VideoPlaybackPreview
                uri={state.video.uri}
                label="Selected story video preview"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
                <Text numberOfLines={2} style={{ color: colors.text, flex: 1 }}>
                  {state.video.name}
                </Text>
                <Pressable onPress={removeVideo} accessibilityLabel="Remove video">
                  <Text style={{ color: colors.danger, fontWeight: '700' }}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {fieldErrors.video ? <Text style={{ color: colors.danger }}>{fieldErrors.video}</Text> : null}
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: state.contributorVisible, disabled: state.isSubmitting }}
          accessibilityLabel="Show my name on this story"
          disabled={state.isSubmitting}
          onPress={() => updateField('contributorVisible', !state.contributorVisible)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: state.contributorVisible ? colors.primary : colors.border,
              backgroundColor: state.contributorVisible ? colors.primary : colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {state.contributorVisible ? (
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  backgroundColor: colors.background,
                }}
              />
            ) : null}
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Show my name on this story</Text>
            <Text style={{ color: colors.muted }}>
              Turn this off to submit anonymously and hide profile access from this story.
            </Text>
          </View>
        </Pressable>

        <Button onPress={submit} disabled={state.isSubmitting} fullWidth>
          {state.isSubmitting ? 'Submitting story...' : 'Submit story'}
        </Button>
      </ScrollView>
    </View>
  );
}
