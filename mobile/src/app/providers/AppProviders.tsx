import React, { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './ThemeProvider';
import { NavigationProvider } from './NavigationProvider';
import { ToastProvider } from '../../shared/toast/ToastProvider';
import { AuthProvider } from '../../features/auth/context/AuthContext';
import { SearchFiltersProvider } from '../../features/search/presentation/context/SearchFiltersContext';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
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
