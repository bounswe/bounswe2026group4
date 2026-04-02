import React from 'react';
import { Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';

export function RegisterPromptScreen() {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        flex: 1,
        padding: spacing.lg,
        justifyContent: 'center',
        gap: spacing.md,
      }}
    >
      <Text style={{ color: colors.primary, fontWeight: '700' }}>Register</Text>
      <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
        Account creation is the next auth step
      </Text>
      <Text style={{ color: colors.muted, fontSize: typography.body }}>
        This shell now exposes a dedicated register entry point so the mobile app can reserve a
        stable auth route before the full signup flow lands.
      </Text>
    </View>
  );
}
