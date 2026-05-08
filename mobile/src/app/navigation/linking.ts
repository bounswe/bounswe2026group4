export const linking = {
  prefixes: ['storymap://'],
  config: {
    screens: {
      Profile: 'profile',
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset-password',
      UserProfile: 'users/:id',
      StoryDetail: 'stories/:id',
      Timeline: 'timeline',
    },
  },
};

export function getProfilePath() {
  return '/profile';
}

export function getForgotPasswordPath() {
  return '/forgot-password';
}

export function getResetPasswordPath(token: string) {
  return `/reset-password?token=${encodeURIComponent(token)}`;
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

function normalizePath(value: string) {
  if (!value) {
    return '/';
  }

  try {
    const parsedUrl = new URL(value);
    const pathname = parsedUrl.pathname || (parsedUrl.hostname ? `/${parsedUrl.hostname}` : '/');

    return `${pathname}${parsedUrl.search}`;
  } catch {
    return value.startsWith('/') ? value : `/${value}`;
  }
}

export function isForgotPasswordPath(pathOrUrl: string) {
  const normalizedPath = normalizePath(pathOrUrl).split('?')[0];

  return normalizedPath === '/forgot-password';
}

export function getResetPasswordTokenFromPath(pathOrUrl: string) {
  const normalizedPath = normalizePath(pathOrUrl);
  const [pathname, queryString = ''] = normalizedPath.split('?');

  if (pathname !== '/reset-password' && !pathname.startsWith('/reset-password/')) {
    return null;
  }

  const tokenFromQuery = queryString
    .split('&')
    .map((part) => part.split('='))
    .find(([key]) => key === 'token')?.[1];

  if (tokenFromQuery) {
    return decodeURIComponent(tokenFromQuery);
  }

  const tokenFromPath = pathname.match(/^\/reset-password\/([^/]+)$/)?.[1];

  return tokenFromPath ? decodeURIComponent(tokenFromPath) : null;
}
