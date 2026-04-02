import React, { PropsWithChildren, createContext, useContext, useMemo, useState } from 'react';
import { AppRoute } from '../navigation/routes';

interface NavigationContextValue {
  currentRoute: AppRoute;
  navigate: (route: AppRoute) => void;
}

interface NavigationProviderProps extends PropsWithChildren {
  initialRoute?: AppRoute;
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

export function NavigationProvider({
  children,
  initialRoute = 'map',
}: NavigationProviderProps) {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(initialRoute);

  const value = useMemo(
    () => ({
      currentRoute,
      navigate: setCurrentRoute,
    }),
    [currentRoute],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useAppNavigation() {
  const context = useContext(NavigationContext);

  if (!context) {
    throw new Error('useAppNavigation must be used within a NavigationProvider.');
  }

  return context;
}
