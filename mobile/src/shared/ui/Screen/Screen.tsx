import React, { PropsWithChildren } from 'react';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../core/hooks/useAppTheme';

interface ScreenProps extends PropsWithChildren {
  edges?: Edge[];
}

export function Screen({ children, edges }: ScreenProps) {
  const { colors } = useAppTheme();

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.background }}>
      {children}
    </SafeAreaView>
  );
}
