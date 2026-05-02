import { mapStoryCommentEntity } from '../mappers';
import { interactionsRemoteSource } from '../sources';
import { StoryCommentEntity } from '../../domain/entities';
import { InteractionRepository } from '../../domain/repositories';

export class InteractionRepositoryImpl implements InteractionRepository {
  async getComments(storyId: string): Promise<StoryCommentEntity[]> {
    const response = await interactionsRemoteSource.getComments(storyId);
    return response.map(mapStoryCommentEntity);
  }

  async addComment(storyId: string, text: string): Promise<StoryCommentEntity> {
    const response = await interactionsRemoteSource.addComment(storyId, text);
    return mapStoryCommentEntity(response);
  }

  async deleteComment(commentId: string): Promise<void> {
    await interactionsRemoteSource.deleteComment(commentId);
  }

  async likeStory(storyId: string): Promise<void> {
    await interactionsRemoteSource.likeStory(storyId);
  }

  async unlikeStory(storyId: string): Promise<void> {
    await interactionsRemoteSource.unlikeStory(storyId);
  }

  async bookmarkStory(storyId: string): Promise<void> {
    await interactionsRemoteSource.bookmarkStory(storyId);
  }

  async unbookmarkStory(storyId: string): Promise<void> {
    await interactionsRemoteSource.unbookmarkStory(storyId);
  }
}
