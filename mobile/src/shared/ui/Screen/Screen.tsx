import React, { PropsWithChildren } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../core/hooks/useAppTheme';

export function Screen({ children }: PropsWithChildren) {
  const { colors } = useAppTheme();

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>{children}</SafeAreaView>;
}
