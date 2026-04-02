import React from 'react';
import { Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';

export function ProfileScreen() {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        padding: spacing.md,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '700' }}>
        Profile screen placeholder
      </Text>
      <Text style={{ marginTop: spacing.sm, color: colors.muted }}>
        This area is now protected by the shared auth state and is ready for real profile data.
      </Text>
    </View>
  );
}
