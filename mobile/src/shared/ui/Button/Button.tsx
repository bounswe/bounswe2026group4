import React, { PropsWithChildren } from 'react';
import { Pressable, Text } from 'react-native';
import { colors, spacing } from '../../../app/theme';

interface ButtonProps extends PropsWithChildren {
  onPress?: () => void;
}

export function Button({ children, onPress }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: spacing.md - 4,
        borderRadius: 8,
        backgroundColor: colors.primary,
      }}
    >
      <Text style={{ color: '#FFFFFF' }}>{children ?? 'Button'}</Text>
    </Pressable>
  );
}
