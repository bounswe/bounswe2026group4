import React, { PropsWithChildren } from 'react';
import { Pressable, Text } from 'react-native';
import { useAppTheme } from '../../../core/hooks/useAppTheme';

interface ButtonProps extends PropsWithChildren {
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export function Button({
  children,
  onPress,
  disabled = false,
  variant = 'primary',
}: ButtonProps) {
  const { colors, spacing } = useAppTheme();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        paddingVertical: spacing.md - 4,
        paddingHorizontal: spacing.md,
        borderRadius: 12,
        backgroundColor: isPrimary ? colors.primary : colors.surface,
        borderWidth: isPrimary ? 0 : 1,
        borderColor: colors.border,
        opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
        alignItems: 'center',
      })}
    >
      <Text style={{ color: isPrimary ? '#FFFFFF' : colors.text, fontWeight: '600' }}>
        {children ?? 'Button'}
      </Text>
    </Pressable>
  );
}
