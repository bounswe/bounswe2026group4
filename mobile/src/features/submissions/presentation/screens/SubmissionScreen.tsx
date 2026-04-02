import React from 'react';
import { Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';

export function SubmissionScreen() {
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
        Submission screen placeholder
      </Text>
      <Text style={{ marginTop: spacing.sm, color: colors.muted }}>
        Auth guard is active. The actual submission form can be added on top of this protected shell.
      </Text>
    </View>
  );
}
