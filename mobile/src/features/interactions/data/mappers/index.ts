export function mapInteraction(value: unknown) {
  return value;
}
import { StoryCommentEntity } from '../../domain/entities';

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asIdentifier(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

export function mapStoryCommentEntity(value: unknown): StoryCommentEntity {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid story comment payload.');
  }

  const comment = value as Record<string, unknown>;
  const id = asIdentifier(comment.id);
  const text = asString(comment.text) || asString(comment.body);
  const createdAt = asString(comment.created_at) || asString(comment.createdAt);
  const storyId = asIdentifier(comment.story_id);
  const isAnonymized = comment.is_anonymized === true;
  const authorUsername = asString(comment.author_username) || (isAnonymized ? 'Anonymous' : 'Anonymous');

  if (!id || !text || !createdAt) {
    throw new Error('Invalid story comment payload.');
  }

  return {
    id,
    storyId,
    authorUsername,
    text,
    createdAt,
    isAnonymized,
  };
}
