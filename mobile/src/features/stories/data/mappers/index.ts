import {
  StoryCommentPreview,
  StoryEntity,
  StoryLocation,
  StoryMapPin,
  StorySummaryEntity,
} from '../../domain/entities';

interface StoryMediaItemRecord {
  id?: unknown;
  url?: unknown;
  media_type?: unknown;
  order?: unknown;
}

interface StoryRecord {
  id: string | number;
  title?: unknown;
  narrative?: unknown;
  status?: unknown;
  location?: unknown;
  location_name?: unknown;
  location_lat?: unknown;
  location_lng?: unknown;
  timePeriod?: unknown;
  time_type?: unknown;
  year?: unknown;
  year_start?: unknown;
  year_end?: unknown;
  contributorName?: unknown;
  contributor_name?: unknown;
  submittedAt?: unknown;
  submitted_at?: unknown;
  mediaUrl?: unknown;
  media_items?: unknown;
  likeCount?: unknown;
  like_count?: unknown;
  likedByViewer?: unknown;
  user_has_liked?: unknown;
  comments?: unknown;
}

function isCommentPreview(value: unknown): value is StoryCommentPreview {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const comment = value as Record<string, unknown>;
  const id = comment.id;

  return (
    (typeof id === 'string' || typeof id === 'number') &&
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
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function asIdentifier(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
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

function formatTimePeriodFromRecord(story: StoryRecord | Record<string, unknown>) {
  const timeType = story.time_type;
  const year = asNumber(story.year);
  const yearStart = asNumber(story.year_start);
  const yearEnd = asNumber(story.year_end);
  const explicit = asString((story as Record<string, unknown>).timePeriod) || asString((story as Record<string, unknown>).time_period);

  if (explicit) {
    return explicit;
  }

  switch (timeType) {
    case 'exact_year':
      return year !== undefined ? String(year) : '';
    case 'approximate_year':
      return year !== undefined ? `c. ${year}` : '';
    case 'decade':
      return year !== undefined ? `${Math.floor(year / 10) * 10}s` : '';
    case 'year_range':
      return yearStart !== undefined && yearEnd !== undefined ? `${yearStart}-${yearEnd}` : '';
    default:
      return '';
  }
}

function getNarrativeParagraphs(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((paragraph): paragraph is string => typeof paragraph === 'string' && paragraph.trim().length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }

  return [];
}

function getLocation(value: StoryRecord) {
  if (isStoryLocation(value.location)) {
    return value.location;
  }

  return {
    name: asString(value.location_name),
    latitude: asNumber(value.location_lat) ?? 0,
    longitude: asNumber(value.location_lng) ?? 0,
  };
}

function getPrimaryMediaUrl(value: StoryRecord) {
  if (typeof value.mediaUrl === 'string') {
    return value.mediaUrl;
  }

  if (!Array.isArray(value.media_items)) {
    return undefined;
  }

  const firstImage = (value.media_items as StoryMediaItemRecord[])
    .filter((item) => item?.media_type === 'image')
    .sort((left, right) => (asNumber(left.order) ?? 0) - (asNumber(right.order) ?? 0))[0];

  return typeof firstImage?.url === 'string' ? firstImage.url : undefined;
}

function getContributorName(value: StoryRecord) {
  return asString(value.contributorName) || asString(value.contributor_name) || 'Anonymous';
}

export function mapStory(value: unknown): StoryEntity {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid story payload.');
  }

  const story = value as StoryRecord;
  const id = asIdentifier(story.id);
  const narrative = getNarrativeParagraphs(story.narrative);
  const location = getLocation(story);
  const submittedAt = asString(story.submittedAt) || asString(story.submitted_at);
  const status = story.status === 'removed' ? 'removed' : 'published';
  const comments = Array.isArray(story.comments) && story.comments.every(isCommentPreview) ? story.comments : [];

  if (!id || typeof story.title !== 'string' || !narrative.length || !location.name || !submittedAt) {
    throw new Error('Invalid story payload.');
  }

  return {
    id,
    title: story.title,
    narrative,
    status,
    location,
    timePeriod: formatTimePeriodFromRecord(story),
    contributorName: getContributorName(story),
    submittedAt,
    mediaUrl: getPrimaryMediaUrl(story),
    likeCount: asNumber(story.likeCount) ?? asNumber(story.like_count) ?? 0,
    likedByViewer: asBoolean(story.likedByViewer, asBoolean(story.user_has_liked, false)),
    comments,
  };
}

export function mapStorySummary(value: unknown): StorySummaryEntity {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid story summary payload.');
  }

  const story = value as Record<string, unknown>;
  const locationRecord =
    story.location && typeof story.location === 'object' ? (story.location as Record<string, unknown>) : undefined;
  const placeName =
    asString(story.placeName) ||
    asString(story.location_name) ||
    asString(story.locationName) ||
    asString(locationRecord?.name);
  const timePeriod =
    asString(story.timePeriod) || asString(story.time_period) || asString(story.period);
  const previewText =
    asString(story.previewText) ||
    asString(story.preview_text) ||
    getNarrativePreview(story.narrative) ||
    asString(story.summary);
  const latitude =
    asNumber(story.latitude) ??
    asNumber(story.location_lat) ??
    asNumber(story.locationLat) ??
    asNumber(locationRecord?.latitude);
  const longitude =
    asNumber(story.longitude) ??
    asNumber(story.location_lng) ??
    asNumber(story.locationLng) ??
    asNumber(locationRecord?.longitude);

  const id = asIdentifier(story.id);

  if (!id || typeof story.title !== 'string') {
    throw new Error('Invalid story summary payload.');
  }

  return {
    id,
    title: story.title,
    previewText,
    placeName,
    timePeriod: timePeriod || formatTimePeriodFromRecord(story),
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

export function mapStoryComment(value: unknown): StoryCommentPreview {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid story comment payload.');
  }

  const comment = value as Record<string, unknown>;
  const id = asIdentifier(comment.id);
  const body = asString(comment.body) || asString(comment.text);
  const createdAt = asString(comment.createdAt) || asString(comment.created_at);
  const authorName =
    asString(comment.authorName) ||
    asString(comment.author_username) ||
    (comment.is_anonymized === true ? 'Anonymous' : '') ||
    'Anonymous';

  if (!id || !body || !createdAt) {
    throw new Error('Invalid story comment payload.');
  }

  return {
    id,
    authorName,
    body,
    createdAt,
  };
}
