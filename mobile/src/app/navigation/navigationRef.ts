import { ROUTES } from './routes';

type RedirectReason = 'logout' | 'unauthorized';
type AuthRedirectHandler = (reason: RedirectReason) => void;
type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const navigationRef: {
  redirectToAuth?: AuthRedirectHandler;
  redirectToPublic?: () => void;
  navigate?: (route: AppRoute) => void;
  navigateToUserProfile?: (userId: string) => void;
} = {};
