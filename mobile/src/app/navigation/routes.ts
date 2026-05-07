export const ROUTES = {
  AUTH: 'Auth',
  VERIFY_EMAIL: 'VerifyEmail',
  GUEST_HOME: 'GuestHome',
  USER_HOME: 'UserHome',
  ADMIN_HOME: 'AdminHome',
  MAP: 'Map',
  FEED: 'Feed',
  STORY_DETAIL: 'StoryDetail',
  TIMELINE: 'Timeline',
  SEARCH: 'Search',
  SUBMISSION: 'Submission',
  NOTIFICATIONS: 'Notifications',
  REGISTER: 'register',
  PROFILE_COMPLETION: 'ProfileCompletion',
  PROFILE: 'Profile',
  USER_PROFILE: 'UserProfile',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export interface AppRouteDefinition {
  key: AppRoute;
  label: string;
  tabLabel: string;
  requiresAuth: boolean;
}

export const MAIN_NAV_ROUTES: AppRouteDefinition[] = [
  {
    key: ROUTES.MAP,
    label: 'Home / Map',
    tabLabel: 'Map',
    requiresAuth: false,
  },
  {
    key: ROUTES.TIMELINE,
    label: 'Timeline',
    tabLabel: 'Timeline',
    requiresAuth: false,
  },
  {
    key: ROUTES.FEED,
    label: 'Feed',
    tabLabel: 'Feed',
    requiresAuth: false,
  },
  {
    key: ROUTES.SUBMISSION,
    label: 'Submit Story',
    tabLabel: 'Submit',
    requiresAuth: true,
  },
  {
    key: ROUTES.PROFILE,
    label: 'Profile',
    tabLabel: 'Profile',
    requiresAuth: true,
  },
] as const;

export const AUTH_ACTION_ROUTES = [
  {
    key: ROUTES.AUTH,
    label: 'Login',
    tabLabel: 'Login',
    requiresAuth: false,
  },
  {
    key: ROUTES.REGISTER,
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
