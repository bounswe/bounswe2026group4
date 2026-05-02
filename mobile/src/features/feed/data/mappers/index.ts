import { FeedEntity, FeedPageEntity } from '../../domain/entities';

interface FeedApiRecord {
  id: number | string;
  title?: unknown;
  location_name?: unknown;
  time_type?: unknown;
  year?: unknown;
  year_start?: unknown;
  year_end?: unknown;
  preview_text?: unknown;
  narrative?: unknown;
  submitted_at?: unknown;
  images?: unknown;
  media_items?: unknown;
  has_media?: unknown;
  like_count?: unknown;
  likeCount?: unknown;
  likes_count?: unknown;
  total_likes?: unknown;
  user_has_saved?: unknown;
  savedByViewer?: unknown;
  tags?: unknown;
  tag_names?: unknown;
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

function asInteger(value: unknown, fallback: number) {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
}

function getPreviewText(value: FeedApiRecord) {
  if (typeof value.preview_text === 'string') {
    return value.preview_text;
  }

  if (typeof value.narrative === 'string') {
    return value.narrative.split(/\s+/).slice(0, 20).join(' ');
  }

  return '';
}

function hasMedia(value: FeedApiRecord) {
  if (typeof value.has_media === 'boolean') {
    return value.has_media;
  }

  if (Array.isArray(value.images)) {
    return value.images.length > 0;
  }

  if (Array.isArray(value.media_items)) {
    return value.media_items.length > 0;
  }

  return false;
}

function getTags(value: FeedApiRecord) {
  const rawTags = Array.isArray(value.tags)
    ? value.tags
    : Array.isArray(value.tag_names)
      ? value.tag_names
      : [];

  return rawTags
    .map((tag) => {
      if (typeof tag === 'string') {
        return tag.trim();
      }

      if (tag && typeof tag === 'object') {
        const record = tag as Record<string, unknown>;

        if (typeof record.name === 'string') {
          return record.name.trim();
        }

        if (typeof record.label === 'string') {
          return record.label.trim();
        }

        if (typeof record.slug === 'string') {
          return record.slug.trim();
        }
      }

      return '';
    })
    .filter((tag, index, tags): tag is string => tag.length > 0 && tags.indexOf(tag) === index);
}

function formatTimePeriod(record: FeedApiRecord) {
  const year = asInteger(record.year, NaN);
  const yearStart = asInteger(record.year_start, NaN);
  const yearEnd = asInteger(record.year_end, NaN);

  switch (record.time_type) {
    case 'exact_year':
      return Number.isFinite(year) ? String(year) : '';
    case 'approximate_year':
      return Number.isFinite(year) ? `c. ${year}` : '';
    case 'decade':
      return Number.isFinite(year) ? `${Math.floor(year / 10) * 10}s` : '';
    case 'year_range':
      return Number.isFinite(yearStart) && Number.isFinite(yearEnd) ? `${yearStart}-${yearEnd}` : '';
    default:
      return '';
  }
}

export function mapFeedItem(value: unknown): FeedEntity {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid feed item payload.');
  }

  const record = value as FeedApiRecord;
  const id = typeof record.id === 'string' || typeof record.id === 'number' ? String(record.id) : undefined;

  if (!id || typeof record.title !== 'string') {
    throw new Error('Invalid feed item payload.');
  }

  return {
    id,
    title: record.title,
    locationName: asString(record.location_name),
    timePeriod: formatTimePeriod(record),
    previewText: getPreviewText(record),
    submittedAt: asString(record.submitted_at),
    hasMedia: hasMedia(record),
    likeCount:
      asNumber(record.likeCount) ??
      asNumber(record.like_count) ??
      asNumber(record.likes_count) ??
      asNumber(record.total_likes) ??
      0,
    savedByViewer: asBoolean(record.savedByViewer, asBoolean(record.user_has_saved, false)),
    tags: getTags(record),
  };
}

export function mapFeedPage(value: unknown, requestedPage: number, pageSize: number): FeedPageEntity {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid feed page payload.');
  }

  const record = value as Record<string, unknown>;
  const results = Array.isArray(record.results) ? record.results.map(mapFeedItem) : [];
  const totalCount = asNumber(record.count) ?? 0;

  return {
    items: results,
    page: requestedPage,
    pageSize,
    totalCount,
    hasNextPage: Boolean(record.next),
  };
}
