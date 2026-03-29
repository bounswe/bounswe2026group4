import React, { PropsWithChildren } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { NavigationProvider } from './NavigationProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <NavigationProvider>{children}</NavigationProvider>
    </ThemeProvider>
  );
}
