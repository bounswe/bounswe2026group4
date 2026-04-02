import { Session } from '../../../../core/auth/session';

export interface AuthUiState {
  email: string;
  password: string;
  isLoading: boolean;
  error?: string;
}

export interface AuthState {
  isLoading: boolean;
  session: Session | null;
  error?: string;
}

export function createInitialAuthState(): AuthState {
  return {
    isLoading: true,
    session: null,
  };
}
