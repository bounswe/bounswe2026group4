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
  alt_text?: unknown;
  altText?: unknown;
  caption?: unknown;
  media_type?: unknown;
  mediaType?: unknown;
  order?: unknown;
}

interface StoryRecord {
  id: string | number;
  user?: unknown;
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
  temporalCoverageIso8601?: unknown;
  temporal_coverage_iso8601?: unknown;
  contributorName?: unknown;
  contributor_name?: unknown;
  contributor_visibility?: unknown;
  contributorVisibility?: unknown;
  is_anonymous?: unknown;
  isAnonymous?: unknown;
  submittedAt?: unknown;
  submitted_at?: unknown;
  mediaUrl?: unknown;
  media_url?: unknown;
  mediaAltText?: unknown;
  media_alt_text?: unknown;
  media_items?: unknown;
  tags?: unknown;
  tag_names?: unknown;
  likeCount?: unknown;
  like_count?: unknown;
  likedByViewer?: unknown;
  user_has_liked?: unknown;
  comments?: unknown;
}

interface StoryMapFeatureRecord {
  id?: unknown;
  geometry?: unknown;
  properties?: unknown;
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
  const temporalCoverage = asString(story.temporalCoverageIso8601) || asString(story.temporal_coverage_iso8601);

  if (temporalCoverage) {
    return temporalCoverage;
  }

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

function formatTimePeriodFromRecord(story: StoryRecord | Record<string, unknown>) {
  const temporalCoverage = getTemporalCoverageIso8601(story);

  if (temporalCoverage) {
    return temporalCoverage;
  }

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

  if (typeof value.media_url === 'string') {
    return value.media_url;
  }

  if (!Array.isArray(value.media_items)) {
    return undefined;
  }

  const firstImage = (value.media_items as StoryMediaItemRecord[])
    .filter((item) => (item?.media_type ?? item?.mediaType) === 'image')
    .sort((left, right) => (asNumber(left.order) ?? 0) - (asNumber(right.order) ?? 0))[0];

  return typeof firstImage?.url === 'string' ? firstImage.url : undefined;
}

function getPrimaryMediaAltText(value: StoryRecord) {
  const explicitAltText = asString(value.mediaAltText) || asString(value.media_alt_text);

  if (explicitAltText) {
    return explicitAltText;
  }

  if (!Array.isArray(value.media_items)) {
    return undefined;
  }

  const firstImage = (value.media_items as StoryMediaItemRecord[])
    .filter((item) => (item?.media_type ?? item?.mediaType) === 'image')
    .sort((left, right) => (asNumber(left.order) ?? 0) - (asNumber(right.order) ?? 0))[0];

  return asString(firstImage?.alt_text) || asString(firstImage?.altText) || asString(firstImage?.caption) || undefined;
}

function getTags(value: StoryRecord | Record<string, unknown>) {
  let rawTags: unknown[] = [];

  if (Array.isArray(value.tags)) {
    rawTags = value.tags;
  } else if (Array.isArray((value as StoryRecord).tag_names)) {
    rawTags = (value as StoryRecord).tag_names as unknown[];
  }

  return rawTags
    .map((tag) => {
      if (typeof tag === 'string') {
        return tag.trim();
      }

      if (tag && typeof tag === 'object') {
        const tagRecord = tag as Record<string, unknown>;
        return asString(tagRecord.name) || asString(tagRecord.label) || asString(tagRecord.slug);
      }

      return '';
    })
    .filter((tag, index, tags): tag is string => tag.length > 0 && tags.indexOf(tag) === index);
}

function getTemporalCoverageIso8601(value: StoryRecord | Record<string, unknown>) {
  return asString(value.temporalCoverageIso8601) || asString(value.temporal_coverage_iso8601) || undefined;
}

function isAnonymousStory(value: StoryRecord) {
  const visibility = asString(value.contributor_visibility) || asString(value.contributorVisibility);

  return visibility === 'anonymous' || value.is_anonymous === true || value.isAnonymous === true;
}

function getContributorName(value: StoryRecord) {
  if (isAnonymousStory(value)) {
    return '';
  }

  const resolvedName = asString(value.contributorName) || asString(value.contributor_name);

  if (resolvedName) {
    return resolvedName;
  }

  if (!asStringId(value.user)) {
    return 'Deleted user';
  }

  return 'Anonymous';
}

function formatTimePeriodFromProperties(properties: Record<string, unknown>) {
  return formatTimePeriod({
    time_type: properties.time_type,
    year: properties.year,
    year_start: properties.year_start,
    year_end: properties.year_end,
  });
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
    contributorUserId: asStringId(story.user),
    title: story.title,
    narrative,
    status,
    location,
    timePeriod: formatTimePeriodFromRecord(story),
    temporalCoverageIso8601: getTemporalCoverageIso8601(story),
    contributorName: getContributorName(story),
    isContributorAnonymous: isAnonymousStory(story),
    submittedAt,
    mediaUrl: getPrimaryMediaUrl(story),
    mediaAltText: getPrimaryMediaAltText(story),
    tags: getTags(story),
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
  const id = asStringId(story.id);
  const placeName =
    asString(story.placeName) ||
    asString(story.location_name) ||
    asString(story.locationName) ||
    asString(locationRecord?.name);
  const temporalCoverageIso8601 = getTemporalCoverageIso8601(story);
  const timePeriod = temporalCoverageIso8601 || formatTimePeriod(story);
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
    timePeriod: timePeriod || formatTimePeriodFromRecord(story),
    temporalCoverageIso8601,
    tags: getTags(story),
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
    temporalCoverageIso8601: summary.temporalCoverageIso8601,
    tags: summary.tags,
    latitude: summary.latitude,
    longitude: summary.longitude,
  };
}

export function mapGeoJSONStoryMapPin(value: unknown): StoryMapPin {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid story map pin payload.');
  }

  const feature = value as StoryMapFeatureRecord;
  const id = asIdentifier(feature.id);
  const properties =
    feature.properties && typeof feature.properties === 'object'
      ? (feature.properties as Record<string, unknown>)
      : undefined;
  const geometry =
    feature.geometry && typeof feature.geometry === 'object'
      ? (feature.geometry as Record<string, unknown>)
      : undefined;
  const coordinates = Array.isArray(geometry?.coordinates) ? geometry.coordinates : undefined;
  const longitude = asNumber(coordinates?.[0]);
  const latitude = asNumber(coordinates?.[1]);
  const title = asString(properties?.title);

  if (!id || !title || latitude === undefined || longitude === undefined) {
    throw new Error('Invalid story map pin payload.');
  }

  return {
    id,
    title,
    previewText: asString(properties?.preview_text),
    placeName: asString(properties?.location_name),
    timePeriod: getTemporalCoverageIso8601(properties ?? {}) || formatTimePeriodFromProperties(properties ?? {}),
    temporalCoverageIso8601: getTemporalCoverageIso8601(properties ?? {}),
    tags: getTags(properties ?? {}),
    latitude,
    longitude,
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
    (comment.is_anonymized === true || comment.isAnonymized === true ? 'Deleted account' : '') ||
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
