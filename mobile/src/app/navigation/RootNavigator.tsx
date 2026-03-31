import React from 'react';
import { StatusBar } from 'react-native';
import { Screen } from '../../shared/ui/Screen';
import { StoryScreen } from '../../features/stories';
import { getStoryIdFromPath } from './linking';

interface RootNavigatorProps {
  initialPath?: string;
}

export function RootNavigator({ initialPath = '/stories/story-001' }: RootNavigatorProps) {
  const storyId = getStoryIdFromPath(initialPath);

  return (
    <Screen>
      <StatusBar barStyle="dark-content" />
      <StoryScreen storyId={storyId ?? 'missing-story'} />
    </Screen>
  );
}
