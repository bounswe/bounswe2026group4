export interface InteractionEntity {
  id: string;
}

export interface StoryCommentEntity {
  id: string;
  storyId?: string;
  authorUsername: string;
  text: string;
  createdAt: string;
  isAnonymized?: boolean;
}
