import React, { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Session } from '../../../../core/auth/session';
import { logoutCurrentUser, restoreAuthSession } from '../../application/useCases';

interface AuthContextValue {
  session: Session | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  isLoggingOut: boolean;
  setSession: (session: Session | null) => void;
  signOut: () => Promise<void>;
}

interface AuthProviderProps extends PropsWithChildren {
  initialSession?: Session | null;
  skipRestore?: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
  initialSession = null,
  skipRestore = false,
}: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(initialSession);
  const [isRestoring, setIsRestoring] = useState(!skipRestore);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (skipRestore) {
      setIsRestoring(false);
      return;
    }

    let isMounted = true;

    restoreAuthSession()
      .then((restoredSession) => {
        if (isMounted) {
          setSession(restoredSession);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsRestoring(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [skipRestore]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session),
      isRestoring,
      isLoggingOut,
      setSession,
      signOut: async () => {
        if (!session) {
          return;
        }

        setIsLoggingOut(true);

        try {
          await logoutCurrentUser(session);
          setSession(null);
        } finally {
          setIsLoggingOut(false);
        }
      },
    }),
    [isLoggingOut, isRestoring, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
