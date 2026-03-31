export const linking = {
  prefixes: [],
  config: {
    screens: {
      StoryDetail: 'stories/:id',
    },
  },
};

export function getStoryPath(storyId: string) {
  return `/stories/${storyId}`;
}

export function getStoryIdFromPath(path: string) {
  const match = path.match(/^\/stories\/([^/]+)$/);

  return match?.[1] ?? null;
}
