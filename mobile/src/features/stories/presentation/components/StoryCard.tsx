import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { StoryEntity } from '../../domain/entities';

interface StoryCardProps {
  story: StoryEntity;
  onPress?: (storyId: string) => void;
}

export function StoryCard({ story, onPress }: StoryCardProps) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <Pressable
      onPress={() => onPress?.(story.id)}
      style={{
        padding: spacing.md,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '700' }}>
        {story.title}
      </Text>
      <Text style={{ marginTop: spacing.sm, color: colors.muted }}>
        {story.location.name} · {story.timePeriod}
      </Text>
      <Text style={{ marginTop: spacing.sm, color: colors.text }}>
        {story.narrative[0]}
      </Text>
    </Pressable>
  );
}
