import React, { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './ThemeProvider';
import { NavigationProvider } from './NavigationProvider';
import { ToastProvider } from '../../shared/toast/ToastProvider';
import { AuthProvider } from '../../features/auth/context/AuthContext';
import { SearchFiltersProvider } from '../../features/search/presentation/context/SearchFiltersContext';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, right: 0, bottom: 34, left: 0 },
};

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SearchFiltersProvider>
              <NavigationProvider>{children}</NavigationProvider>
            </SearchFiltersProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
