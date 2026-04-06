export const linking = {
  prefixes: [],
  config: {
    screens: {
      Profile: 'profile',
      UserProfile: 'users/:id',
      StoryDetail: 'stories/:id',
    },
  },
};

export function getProfilePath() {
  return '/profile';
}

export function getUserProfilePath(userId: string) {
  return `/users/${userId}`;
}

export function getStoryPath(storyId: string) {
  return `/stories/${storyId}`;
}

export function getUserIdFromProfilePath(path: string) {
  const match = path.match(/^\/users\/([^/]+)$/);

  return match?.[1] ?? null;
}

export function getStoryIdFromPath(path: string) {
  const match = path.match(/^\/stories\/([^/]+)$/);

  return match?.[1] ?? null;
}
