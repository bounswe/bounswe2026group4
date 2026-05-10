import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { TimelineEntity } from '../../domain/entities';

interface TimelineCardProps {
  story: TimelineEntity;
  onPress?: (storyId: string) => void;
  isLast?: boolean;
}

function getBadgeLabel(story: TimelineEntity) {
  if (story.timePeriod) {
    return story.timePeriod;
  }

  if (story.timeType === 'decade' && story.historicalYear !== undefined) {
    return formatTimelineBadgeYear(story.historicalYear);
  }

  return story.historicalYear !== undefined ? String(story.historicalYear) : 'Time';
}

function formatTimelineBadgeYear(year: number) {
  const decade = Math.floor(Math.abs(year) / 10) * 10;

  return year < 0 ? `${decade}s BC` : `${decade}s`;
}

export function TimelineCard({ story, onPress, isLast = false }: TimelineCardProps) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open timeline story: ${story.title}`}
      onPress={() => onPress?.(story.id)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: spacing.md,
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <View style={{ width: 112, alignItems: 'center' }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            ...(isLast ? { height: spacing.lg } : { bottom: -spacing.md }),
            width: 2,
            backgroundColor: colors.border,
          }}
        />
        <View
          style={{
            minWidth: 72,
            maxWidth: 108,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs + 2,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.text,
            backgroundColor: colors.background,
            alignItems: 'center',
          }}
        >
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.65}
            numberOfLines={1}
            style={{
              color: colors.text,
              fontSize: typography.caption,
              fontWeight: '800',
              textAlign: 'center',
              width: '100%',
            }}
          >
            {getBadgeLabel(story)}
          </Text>
        </View>
      </View>

      <View
        style={{
          flex: 1,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        }}
      >
        {story.photoUrl ? (
          <Image
            source={{ uri: story.photoUrl }}
            resizeMode="cover"
            accessibilityLabel={`Photo for ${story.title}`}
            style={{ width: '100%', height: 132, backgroundColor: colors.infoSurface }}
          />
        ) : null}
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800', lineHeight: 24 }}>
            {story.title}
          </Text>

          {story.locationName ? (
            <Text
              numberOfLines={2}
              style={{ color: colors.muted, fontSize: typography.body, lineHeight: 21 }}
            >
              {story.locationName}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
