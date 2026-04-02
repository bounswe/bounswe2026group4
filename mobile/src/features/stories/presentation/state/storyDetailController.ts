import { canAccessRestrictedActions } from '../../../../core/auth/guards';
import { Session } from '../../../../core/auth/session';
import { StoryEntity } from '../../domain/entities';
import { storyService } from '../../application/services';
import { StoryDetailUiState, createInitialStoryDetailUiState } from './storiesUiState';

export async function loadStoryDetail(
  storyId: string,
  role: Session['role'] = 'guest',
  getStory: typeof storyService.getStory = storyService.getStory,
): Promise<StoryDetailUiState> {
  try {
    const story = await getStory(storyId);

    if (!story) {
      return {
        ...createInitialStoryDetailUiState(canAccessRestrictedActions(role ?? 'guest')),
        isLoading: false,
        error: 'not-found',
      };
    }

    return {
      ...createInitialStoryDetailUiState(canAccessRestrictedActions(role ?? 'guest')),
      isLoading: false,
      story,
    };
  } catch {
    return {
      ...createInitialStoryDetailUiState(canAccessRestrictedActions(role ?? 'guest')),
      isLoading: false,
      error: 'unknown',
    };
  }
}

export function toggleStoryLike(
  state: StoryDetailUiState,
): { nextState: StoryDetailUiState; requiresLogin: boolean } {
  if (!state.story) {
    return { nextState: state, requiresLogin: false };
  }

  if (!state.isAuthenticated) {
    return {
      requiresLogin: true,
      nextState: {
        ...state,
        loginPromptVisible: true,
      },
    };
  }

  const likedByViewer = !state.story.likedByViewer;
  const likeCount = state.story.likeCount + (likedByViewer ? 1 : -1);

  return {
    requiresLogin: false,
    nextState: {
      ...state,
      loginPromptVisible: false,
      story: {
        ...state.story,
        likedByViewer,
        likeCount,
      },
    },
  };
}
