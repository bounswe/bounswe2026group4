import React, {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AuthUser } from '../../../core/auth/session';
import { interceptors } from '../../../core/api/interceptors';
import { authService } from '../application/services';
import { createInitialAuthState } from '../presentation/state/authUiState';

interface LoginInput {
  email: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(createInitialAuthState);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    tokenRef.current = state.token;
  }, [state.token]);

  useEffect(() => {
    let isMounted = true;

    authService
      .restore()
      .then((session) => {
        if (!isMounted) {
          return;
        }

        setState({
          isLoading: false,
          user: session?.user ?? null,
          token: session?.token ?? null,
          isAuthenticated: Boolean(session?.token),
        });
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setState({
          isLoading: false,
          user: null,
          token: null,
          isAuthenticated: false,
          error: 'Failed to restore the active session.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const requestId = interceptors.request.use(async (config) => {
      if (!tokenRef.current) {
        return config;
      }

      return {
        ...config,
        headers: {
          ...(config.headers ?? {}),
          Authorization: `Bearer ${tokenRef.current}`,
        },
      };
    });

    const responseId = interceptors.response.use(undefined, async (error) => {
      const status = (error as { response?: { status?: number } })?.response?.status;

      if (status === 401) {
        await authService.logout();
        tokenRef.current = null;
        setState({
          isLoading: false,
          user: null,
          token: null,
          isAuthenticated: false,
          error: 'Your session expired. Please sign in again.',
        });
      }

      return error;
    });

    return () => {
      interceptors.request.eject(requestId);
      interceptors.response.eject(responseId);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      token: state.token,
      isAuthenticated: state.isAuthenticated,
      loading: state.isLoading,
      login: async ({ email, password }) => {
        setState((current) => ({ ...current, isLoading: true, error: undefined }));

        const session = await authService.login(email, password);

        tokenRef.current = session.token;
        setState({
          isLoading: false,
          user: session.user,
          token: session.token,
          isAuthenticated: true,
        });
      },
      logout: async () => {
        await authService.logout();
        tokenRef.current = null;
        setState({
          isLoading: false,
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },
    }),
    [state.isAuthenticated, state.isLoading, state.token, state.user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
