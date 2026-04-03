import { InteractionRepositoryImpl } from '../../data/repositories';
import { StoryCommentEntity } from '../../domain/entities';

const repository = new InteractionRepositoryImpl();

export const interactionService = {
  async getComments(storyId: string): Promise<StoryCommentEntity[]> {
    return repository.getComments(storyId);
  },
  async addComment(storyId: string, text: string): Promise<StoryCommentEntity> {
    return repository.addComment(storyId, text);
  },
  async deleteComment(commentId: string): Promise<void> {
    return repository.deleteComment(commentId);
  },
  async likeStory(storyId: string): Promise<void> {
    return repository.likeStory(storyId);
  },
  async unlikeStory(storyId: string): Promise<void> {
    return repository.unlikeStory(storyId);
  },
};
