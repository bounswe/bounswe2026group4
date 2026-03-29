import React, { PropsWithChildren } from 'react';
import { Pressable, Text } from 'react-native';

export function Button({ children }: PropsWithChildren) {
  return (
    <Pressable style={{ padding: 12, borderRadius: 8, backgroundColor: '#2E6BE6' }}>
      <Text style={{ color: '#FFFFFF' }}>{children ?? 'Button'}</Text>
    </Pressable>
  );
}
