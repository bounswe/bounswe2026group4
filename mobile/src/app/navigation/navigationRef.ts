type RedirectReason = 'logout' | 'unauthorized';

type AuthRedirectHandler = (reason: RedirectReason) => void;

export const navigationRef: {
  redirectToAuth?: AuthRedirectHandler;
  redirectToPublic?: () => void;
} = {};
