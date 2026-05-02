import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { TagChip } from '../../../../shared/components/TagChip';
import { FeedEntity } from '../../domain/entities';

interface FeedCardProps {
  story: FeedEntity;
  onPress?: (storyId: string) => void;
  onTagPress?: (tag: string) => void;
}

function formatSubmittedAt(value: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function FeedCard({ story, onPress, onTagPress }: FeedCardProps) {
  const { colors, spacing, typography } = useAppTheme();
  const tags = story.tags ?? [];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Read story: ${story.title}`}
      onPress={() => onPress?.(story.id)}
      style={{
        padding: spacing.md,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text
          style={{
            flex: 1,
            color: colors.text,
            fontSize: typography.subtitle,
            fontWeight: '700',
          }}
        >
          {story.title}
        </Text>
        {story.hasMedia ? (
          <View
            accessibilityLabel="Has media"
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: typography.caption, fontWeight: '700' }}>
              IMG
            </Text>
          </View>
        ) : null}
      </View>

      {story.locationName ? (
        <Text style={{ color: colors.muted, fontSize: typography.body }}>{story.locationName}</Text>
      ) : null}

      {tags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {tags.map((tag) => (
            <TagChip
              key={tag}
              label={tag}
              value={tag}
              testID={`feed-card-tag-${tag}`}
              onPress={
                onTagPress
                  ? (event) => {
                      event?.stopPropagation?.();
                      onTagPress(tag);
                    }
                  : undefined
              }
            />
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {story.timePeriod ? (
          <View
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: 999,
              backgroundColor: colors.background,
            }}
          >
            <Text style={{ color: colors.text, fontSize: typography.caption, fontWeight: '600' }}>
              {story.timePeriod}
            </Text>
          </View>
        ) : null}
        <View
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: 999,
            backgroundColor: story.savedByViewer ? colors.primary : colors.background,
          }}
        >
          <Text
            style={{
              color: story.savedByViewer ? colors.background : colors.text,
              fontSize: typography.caption,
              fontWeight: '700',
            }}
          >
            {story.savedByViewer ? '♥' : '♡'} {story.likeCount}
          </Text>
        </View>
        {story.submittedAt ? (
          <View
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: 999,
              backgroundColor: colors.infoSurface,
            }}
          >
            <Text style={{ color: colors.text, fontSize: typography.caption, fontWeight: '600' }}>
              {formatSubmittedAt(story.submittedAt)}
            </Text>
          </View>
        ) : null}
      </View>

      {story.previewText ? (
        <Text style={{ color: colors.text, fontSize: typography.body, lineHeight: 22 }}>
          {story.previewText}
        </Text>
      ) : null}
    </Pressable>
  );
}
