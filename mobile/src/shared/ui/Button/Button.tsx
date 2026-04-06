import React, { PropsWithChildren } from 'react';
import { Pressable, Text, ViewStyle } from 'react-native';
import { useAppTheme } from '../../../core/hooks/useAppTheme';

interface ButtonProps extends PropsWithChildren {
  onPress?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  variant?: 'primary' | 'outline' | 'ghost';
}

export function Button({
  children,
  onPress,
  disabled = false,
  fullWidth = false,
  style,
  variant = 'primary',
}: ButtonProps) {
  const { colors, spacing } = useAppTheme();
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md - 2,
        borderRadius: 12,
        backgroundColor: isPrimary ? (disabled ? colors.border : colors.primary) : colors.background,
        borderWidth: isPrimary ? 0 : 1,
        borderColor: colors.border,
        opacity: disabled ? 0.7 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        width: fullWidth ? '100%' : undefined,
        shadowColor: '#000000',
        shadowOpacity: isPrimary ? 0.08 : 0,
        shadowRadius: isPrimary ? 10 : 0,
        shadowOffset: { width: 0, height: 4 },
        elevation: isPrimary ? 2 : 0,
        ...(pressed && !disabled ? { opacity: 0.85 } : null),
        ...(style ?? {}),
      })}
    >
      <Text style={{ color: isPrimary ? colors.background : isOutline ? colors.text : colors.muted, fontWeight: '700' }}>
        {children ?? 'Button'}
      </Text>
    </Pressable>
  );
}
