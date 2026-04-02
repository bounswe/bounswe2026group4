import React, { PropsWithChildren } from 'react';
import { Pressable, Text, ViewStyle } from 'react-native';
import { useAppTheme } from '../../../core/hooks/useAppTheme';

interface ButtonProps extends PropsWithChildren {
  onPress?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  children,
  onPress,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const { colors, spacing } = useAppTheme();

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md - 2,
        borderRadius: 12,
        backgroundColor: disabled ? colors.border : colors.primary,
        opacity: disabled ? 0.7 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        width: fullWidth ? '100%' : undefined,
        ...(style ?? {}),
      }}
    >
      <Text style={{ color: colors.background, fontWeight: '700' }}>
        {children ?? 'Button'}
      </Text>
    </Pressable>
  );
}
