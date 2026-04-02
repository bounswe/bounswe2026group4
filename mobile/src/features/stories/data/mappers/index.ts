import {
  StoryCommentPreview,
  StoryEntity,
  StoryLocation,
  StoryMapPin,
  StorySummaryEntity,
} from '../../domain/entities';

interface StoryRecord {
  id: string;
  title: string;
  narrative: string[];
  status: StoryEntity['status'];
  location: StoryLocation;
  timePeriod: string;
  contributorName: string;
  submittedAt: string;
  mediaUrl?: string;
  likeCount: number;
  likedByViewer: boolean;
  comments: StoryCommentPreview[];
}

function isCommentPreview(value: unknown): value is StoryCommentPreview {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const comment = value as Record<string, unknown>;

  return (
    typeof comment.id === 'string' &&
    typeof comment.authorName === 'string' &&
    typeof comment.body === 'string' &&
    typeof comment.createdAt === 'string'
  );
}

function isStoryLocation(value: unknown): value is StoryLocation {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const location = value as Record<string, unknown>;

  return (
    typeof location.name === 'string' &&
    typeof location.latitude === 'number' &&
    typeof location.longitude === 'number'
  );
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asStringId(value: unknown) {
  if (typeof value === 'string' && value.length) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function asNumericValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function formatTimePeriod(story: Record<string, unknown>) {
  const explicitTimePeriod = asString(story.timePeriod) || asString(story.time_period) || asString(story.period);

  if (explicitTimePeriod) {
    return explicitTimePeriod;
  }

  const timeType = asString(story.time_type) || asString(story.timeType);
  const year = asNumericValue(story.year);
  const yearStart = asNumericValue(story.year_start) ?? asNumericValue(story.yearStart);
  const yearEnd = asNumericValue(story.year_end) ?? asNumericValue(story.yearEnd);

  if (timeType === 'year_range' && yearStart !== undefined && yearEnd !== undefined) {
    return `${yearStart}-${yearEnd}`;
  }

  if (timeType === 'decade' && year !== undefined) {
    return `${year}s`;
  }

  if (year !== undefined) {
    return String(year);
  }

  return '';
}

function getNarrativePreview(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    const firstParagraph = value.find((entry) => typeof entry === 'string');
    return typeof firstParagraph === 'string' ? firstParagraph : '';
  }

  return '';
}

export function mapStory(value: unknown): StoryEntity {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid story payload.');
  }

  const story = value as Partial<StoryRecord>;

  if (
    typeof story.id !== 'string' ||
    typeof story.title !== 'string' ||
    !Array.isArray(story.narrative) ||
    !story.narrative.every((paragraph) => typeof paragraph === 'string') ||
    (story.status !== 'published' && story.status !== 'removed') ||
    !isStoryLocation(story.location) ||
    typeof story.timePeriod !== 'string' ||
    typeof story.contributorName !== 'string' ||
    typeof story.submittedAt !== 'string' ||
    typeof story.likeCount !== 'number' ||
    typeof story.likedByViewer !== 'boolean' ||
    !Array.isArray(story.comments) ||
    !story.comments.every(isCommentPreview)
  ) {
    throw new Error('Invalid story payload.');
  }

  return {
    id: story.id,
    title: story.title,
    narrative: story.narrative,
    status: story.status,
    location: story.location,
    timePeriod: story.timePeriod,
    contributorName: story.contributorName,
    submittedAt: story.submittedAt,
    mediaUrl: typeof story.mediaUrl === 'string' ? story.mediaUrl : undefined,
    likeCount: story.likeCount,
    likedByViewer: story.likedByViewer,
    comments: story.comments,
  };
}

export function mapStorySummary(value: unknown): StorySummaryEntity {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid story summary payload.');
  }

  const story = value as Record<string, unknown>;
  const locationRecord =
    story.location && typeof story.location === 'object' ? (story.location as Record<string, unknown>) : undefined;
  const id = asStringId(story.id);
  const placeName =
    asString(story.placeName) ||
    asString(story.location_name) ||
    asString(story.locationName) ||
    asString(locationRecord?.name);
  const timePeriod = formatTimePeriod(story);
  const previewText =
    asString(story.previewText) ||
    asString(story.preview_text) ||
    getNarrativePreview(story.narrative) ||
    asString(story.summary);
  const latitude =
    asNumericValue(story.latitude) ??
    asNumericValue(story.location_lat) ??
    asNumericValue(story.locationLat) ??
    asNumericValue(locationRecord?.latitude);
  const longitude =
    asNumericValue(story.longitude) ??
    asNumericValue(story.location_lng) ??
    asNumericValue(story.locationLng) ??
    asNumericValue(locationRecord?.longitude);

  if (!id || typeof story.title !== 'string') {
    throw new Error('Invalid story summary payload.');
  }

  return {
    id,
    title: story.title,
    previewText,
    placeName,
    timePeriod,
    latitude,
    longitude,
  };
}

export function mapStoryMapPin(value: unknown): StoryMapPin {
  const summary = mapStorySummary(value);

  if (summary.latitude === undefined || summary.longitude === undefined) {
    throw new Error('Invalid story map pin payload.');
  }

  return {
    id: summary.id,
    title: summary.title,
    previewText: summary.previewText,
    placeName: summary.placeName,
    timePeriod: summary.timePeriod,
    latitude: summary.latitude,
    longitude: summary.longitude,
  };
}
