import { AuthUser } from '../../../../core/auth/session';

export interface AuthState {
  isLoading: boolean;
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  error?: string;
}

export function createInitialAuthState(): AuthState {
  return {
    isLoading: true,
    user: null,
    token: null,
    isAuthenticated: false,
  };
}
