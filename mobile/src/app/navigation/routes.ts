export type AppRoute = 'map' | 'feed' | 'submission' | 'profile' | 'login' | 'register';

export interface AppRouteDefinition {
  key: AppRoute;
  label: string;
  tabLabel: string;
  requiresAuth: boolean;
}

export const MAIN_NAV_ROUTES: AppRouteDefinition[] = [
  {
    key: 'map',
    label: 'Home / Map',
    tabLabel: 'Map',
    requiresAuth: false,
  },
  {
    key: 'feed',
    label: 'Feed',
    tabLabel: 'Feed',
    requiresAuth: false,
  },
  {
    key: 'submission',
    label: 'Submit Story',
    tabLabel: 'Submit',
    requiresAuth: true,
  },
  {
    key: 'profile',
    label: 'Profile',
    tabLabel: 'Profile',
    requiresAuth: true,
  },
] as const;

export const AUTH_ACTION_ROUTES = [
  {
    key: 'login' as const,
    label: 'Login',
    tabLabel: 'Login',
    requiresAuth: false,
  },
  {
    key: 'register' as const,
    label: 'Register',
    tabLabel: 'Register',
    requiresAuth: false,
  },
];

export function isProtectedRoute(route: AppRoute) {
  return MAIN_NAV_ROUTES.some((item) => item.key === route && item.requiresAuth);
}

export function isAuthActionRoute(route: AppRoute) {
  return AUTH_ACTION_ROUTES.some((item) => item.key === route);
}
