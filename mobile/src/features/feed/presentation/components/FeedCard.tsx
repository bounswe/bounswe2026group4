import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Bookmark } from 'lucide-react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { TagChip } from '../../../../shared/components/TagChip';
import { FeedEntity } from '../../domain/entities';

interface FeedCardProps {
  story: FeedEntity;
  onPress?: (storyId: string) => void;
  onTagPress?: (tag: string) => void;
  onBookmarkPress?: (storyId: string) => void;
  isBookmarkPending?: boolean;
  bookmarkAccessibilityLabel?: string;
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

export function FeedCard({
  story,
  onPress,
  onTagPress,
  onBookmarkPress,
  isBookmarkPending = false,
  bookmarkAccessibilityLabel,
}: FeedCardProps) {
  const { colors, spacing, typography } = useAppTheme();
  const tags = story.tags ?? [];
  const bookmarkIndicatorStyle = {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: story.savedByViewer ? colors.primary : colors.border,
    backgroundColor: story.savedByViewer ? colors.primary : colors.background,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const bookmarkIcon = (
    <Bookmark
      size={16}
      color={story.savedByViewer ? colors.background : colors.muted}
      fill={story.savedByViewer ? colors.background : 'transparent'}
      strokeWidth={2.2}
    />
  );

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {onBookmarkPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                bookmarkAccessibilityLabel ?? (story.savedByViewer ? 'Bookmarked story' : 'Not bookmarked story')
              }
              accessibilityState={{ disabled: isBookmarkPending, selected: story.savedByViewer }}
              disabled={isBookmarkPending}
              onPress={(event) => {
                event?.stopPropagation?.();
                onBookmarkPress(story.id);
              }}
              style={({ pressed }) => ({
                ...bookmarkIndicatorStyle,
                opacity: isBookmarkPending ? 0.62 : pressed ? 0.78 : 1,
              })}
            >
              {bookmarkIcon}
            </Pressable>
          ) : (
            <View
              accessibilityLabel={story.savedByViewer ? 'Bookmarked story' : 'Not bookmarked story'}
              style={bookmarkIndicatorStyle}
            >
              {bookmarkIcon}
            </View>
          )}
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
        <View
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: 999,
            backgroundColor: story.likedByViewer ? colors.primary : colors.background,
          }}
        >
          <Text
            style={{
              color: story.likedByViewer ? colors.background : colors.text,
              fontSize: typography.caption,
              fontWeight: '700',
            }}
          >
            {story.likedByViewer ? '♥' : '♡'} {story.likeCount}
          </Text>
        </View>
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
