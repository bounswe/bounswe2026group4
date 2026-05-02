import { StoryCommentEntity } from '../entities';

export interface InteractionRepository {
  getComments(storyId: string): Promise<StoryCommentEntity[]>;
  addComment(storyId: string, text: string): Promise<StoryCommentEntity>;
  deleteComment(commentId: string): Promise<void>;
  likeStory(storyId: string): Promise<void>;
  unlikeStory(storyId: string): Promise<void>;
  bookmarkStory(storyId: string): Promise<void>;
  unbookmarkStory(storyId: string): Promise<void>;
}
