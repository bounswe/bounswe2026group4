import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { navigationRef } from '../../../app/navigation/navigationRef';
import { AuthUser, Session } from '../../../core/auth/session';
import { interceptors } from '../../../core/api/interceptors';
import { authService } from '../application/services';
import { createInitialAuthState } from '../presentation/state/authUiState';
import { RegisterUserInput, RegisterUserResult } from '../domain/repositories';

interface LoginInput {
  email: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (input: LoginInput) => Promise<Session>;
  register: (input: RegisterUserInput) => Promise<RegisterUserResult>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<AuthUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(createInitialAuthState);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    sessionRef.current = state.session;
  }, [state.session]);

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
          session,
        });
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setState({
          isLoading: false,
          session: null,
          error: 'Failed to restore the active session.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const requestId = interceptors.request.use(async (config) => {
      const token = sessionRef.current?.accessToken;

      if (!token) {
        return config;
      }

        return {
          ...config,
          headers: {
            ...(config.headers ?? {}),
            Authorization: `Bearer ${token}`,
          },
        };
    });

    const responseId = interceptors.response.use(undefined, async (error) => {
      const status = (error as { response?: { status?: number } })?.response?.status;

      if (status === 401) {
        await authService.clear();
        sessionRef.current = null;
        setState({
          isLoading: false,
          session: null,
          error: 'Your session expired. Please sign in again.',
        });
        navigationRef.redirectToAuth?.('unauthorized');
      }

      return error;
    });

    return () => {
      interceptors.request.eject(requestId);
      interceptors.response.eject(responseId);
    };
  }, []);

  const login = useCallback(async ({ email, password }: LoginInput) => {
    setState((current) => ({ ...current, isLoading: true, error: undefined }));

    try {
      const session = await authService.login(email, password);

      sessionRef.current = session;
      setState({
        isLoading: false,
        session,
      });

      return session;
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoading: false,
      }));
      throw error;
    }
  }, []);

  const register = useCallback(async (input: RegisterUserInput) => {
    setState((current) => ({ ...current, isLoading: true, error: undefined }));

    try {
      const result = await authService.register(input);

      setState((current) => ({
        ...current,
        isLoading: false,
      }));

      return result;
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoading: false,
      }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    const activeSession = sessionRef.current;

    await authService.logout(activeSession);
    sessionRef.current = null;
    setState({
      isLoading: false,
      session: null,
    });
    navigationRef.redirectToPublic?.();
  }, []);

  const updateUser = useCallback(async (userPatch: Partial<AuthUser>) => {
    const activeSession = sessionRef.current;

    if (!activeSession) {
      return;
    }

    const nextUser = {
      ...activeSession.user,
      ...userPatch,
    };

    const nextSession = await authService.updateUser(nextUser);

    if (!nextSession) {
      return;
    }

    sessionRef.current = nextSession;
    setState({
      isLoading: false,
      session: nextSession,
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.session?.user ?? null,
      isAuthenticated: Boolean(state.session?.accessToken),
      loading: state.isLoading,
      login,
      register,
      logout,
      updateUser,
    }),
    [login, logout, register, state.isLoading, state.session, updateUser],
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
