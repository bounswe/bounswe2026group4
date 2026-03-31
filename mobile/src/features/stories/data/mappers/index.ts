import { StoryCommentPreview, StoryEntity, StoryLocation } from '../../domain/entities';

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
