import React, { PropsWithChildren } from 'react';
import { Pressable, Text } from 'react-native';
import { useAppTheme } from '../../../core/hooks/useAppTheme';

interface ButtonProps extends PropsWithChildren {
  onPress?: () => void;
  disabled?: boolean;
}

export function Button({ children, onPress, disabled = false }: ButtonProps) {
  const { colors, spacing } = useAppTheme();

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={{
        padding: spacing.md - 4,
        borderRadius: 8,
        backgroundColor: disabled ? colors.border : colors.primary,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center' }}>
        {children ?? 'Button'}
      </Text>
    </Pressable>
  );
}
