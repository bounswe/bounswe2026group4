import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../core/hooks/useAppTheme';

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  fullScreen?: boolean;
}

export function EmptyState({
  title = 'Nothing here yet',
  message = 'Content will appear here when it becomes available.',
  actionLabel = 'Refresh',
  onAction,
  fullScreen = false,
}: EmptyStateProps) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        flex: fullScreen ? 1 : undefined,
        minHeight: fullScreen ? undefined : 180,
        padding: spacing.lg,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.muted, fontSize: typography.subtitle }}>...</Text>
      </View>
      <Text
        style={{
          marginTop: spacing.md,
          fontSize: typography.subtitle,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          marginTop: spacing.sm,
          fontSize: typography.body,
          color: colors.muted,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
      {onAction ? (
        <Pressable
          onPress={onAction}
          style={{
            marginTop: spacing.lg,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm + 2,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '600' }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
