import React, { PropsWithChildren } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { NavigationProvider } from './NavigationProvider';
import { ToastProvider } from '../../shared/toast/ToastProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <NavigationProvider>{children}</NavigationProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
