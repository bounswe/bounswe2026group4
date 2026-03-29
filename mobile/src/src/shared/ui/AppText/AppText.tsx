import React, { PropsWithChildren } from 'react';
import { Text } from 'react-native';

export function AppText({ children }: PropsWithChildren) {
  return <Text>{children}</Text>;
}
