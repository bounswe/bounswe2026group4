import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAppTheme } from '../../../core/hooks/useAppTheme';

interface LoaderProps {
  fullScreen?: boolean;
  message?: string;
  size?: 'small' | 'large';
}

export function Loader({
  fullScreen = false,
  message = 'Loading...',
  size = 'large',
}: LoaderProps) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        flex: fullScreen ? 1 : undefined,
        minHeight: fullScreen ? undefined : 120,
        padding: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator size={size} color={colors.primary} />
      {message ? (
        <Text
          style={{
            marginTop: spacing.md,
            color: colors.muted,
            fontSize: typography.body,
            textAlign: 'center',
          }}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}
