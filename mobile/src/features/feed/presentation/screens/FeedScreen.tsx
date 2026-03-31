import React from 'react';
import { Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';

export function FeedScreen() {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View style={{ gap: spacing.md }}>
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
          Feed is ready for story cards
        </Text>
        <Text style={{ marginTop: spacing.sm, color: colors.muted }}>
          This public area will show the mobile story feed once feed data integration lands.
        </Text>
      </View>

      <View
        style={{
          padding: spacing.md,
          borderRadius: 16,
          backgroundColor: colors.infoSurface,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: '600' }}>What to verify now</Text>
        <Text style={{ marginTop: spacing.sm, color: colors.muted }}>
          Navigation, auth redirects, session persistence, and logout behavior should all work here.
        </Text>
      </View>
    </View>
  );
}
