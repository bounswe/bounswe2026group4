import React from 'react';
import { ModerationScreen } from '../../features/moderation';

export function AdminNavigator({
  onOpenStory,
  onOpenComment,
}: {
  onOpenStory?: (storyId: string) => void;
  onOpenComment?: (storyId: string, commentId: string) => void;
}) {
  return <ModerationScreen onOpenStory={onOpenStory} onOpenComment={onOpenComment} />;
}
