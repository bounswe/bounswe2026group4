import { StoryEntity } from '../../domain/entities';

export interface StoryDetailUiState {
  isLoading: boolean;
  story?: StoryEntity;
  error?: 'not-found' | 'unknown';
  isAuthenticated: boolean;
  isLikePending: boolean;
  loginPromptVisible: boolean;
}

export function createInitialStoryDetailUiState(isAuthenticated = false): StoryDetailUiState {
  return {
    isLoading: true,
    isAuthenticated,
    isLikePending: false,
    loginPromptVisible: false,
  };
}
