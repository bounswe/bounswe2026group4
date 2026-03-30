import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../core/hooks/useAppTheme';

interface NotFoundPageProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onGoBack?: () => void;
  fullScreen?: boolean;
}

export function NotFoundPage({
  title = 'Page not found',
  message = "We couldn't find the screen you were looking for.",
  actionLabel = 'Back to home',
  onGoBack,
  fullScreen = true,
}: NotFoundPageProps) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        flex: fullScreen ? 1 : undefined,
        minHeight: fullScreen ? undefined : 280,
        padding: spacing.xl,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 30, fontWeight: '700', color: colors.text }}>404</Text>
      </View>
      <Text
        style={{
          marginTop: spacing.lg,
          fontSize: typography.title,
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
      {onGoBack ? (
        <Pressable
          onPress={onGoBack}
          style={{
            marginTop: spacing.lg,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm + 2,
            borderRadius: 999,
            backgroundColor: colors.primary,
          }}
        >
          <Text style={{ color: colors.background, fontWeight: '600' }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
