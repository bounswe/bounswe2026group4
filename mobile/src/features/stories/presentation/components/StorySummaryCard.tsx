import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { StorySummaryEntity } from '../../domain/entities';

interface StorySummaryCardProps {
  story: StorySummaryEntity;
  onPress?: (storyId: string) => void;
}

export function StorySummaryCard({ story, onPress }: StorySummaryCardProps) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress?.(story.id)}
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
        {story.title}
      </Text>
      <Text style={{ color: colors.muted }}>
        {story.placeName} · {story.timePeriod}
      </Text>
      <Text style={{ color: colors.text }}>{story.previewText}</Text>
      {story.latitude !== undefined && story.longitude !== undefined ? (
        <Text style={{ color: colors.primary, fontSize: typography.caption + 1, fontWeight: '700' }}>
          Pin: {story.latitude.toFixed(4)}, {story.longitude.toFixed(4)}
        </Text>
      ) : null}
    </Pressable>
  );
}
