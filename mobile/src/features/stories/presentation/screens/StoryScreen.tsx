import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { roles } from '../../../../core/auth/roles';
import { Session } from '../../../../core/auth/session';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { storyService } from '../../application/services';
import { StoryEntity } from '../../domain/entities';
import { ErrorState } from '../../../../shared/ui/ErrorState';
import { Loader } from '../../../../shared/ui/Loader';
import { NotFoundPage } from '../../../../shared/ui/NotFoundPage';
import { createInitialStoryDetailUiState } from '../state/storiesUiState';
import { loadStoryDetail, toggleStoryLike } from '../state/storyDetailController';

interface StoryScreenProps {
  storyId: string;
  session?: Pick<Session, 'role'>;
  onRequestLogin?: () => void;
  onGoBack?: () => void;
  getStory?: typeof storyService.getStory;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StoryMetaRow({ label, value }: { label: string; value: string }) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        width: '48%',
        padding: spacing.md,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: typography.caption, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text
        style={{
          marginTop: spacing.xs,
          color: colors.text,
          fontSize: typography.body,
          fontWeight: '600',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function StoryMiniMap({ story }: { story: StoryEntity }) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        marginTop: spacing.xl,
        padding: spacing.lg,
        borderRadius: 20,
        backgroundColor: colors.infoSurface,
      }}
    >
      <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '700' }}>
        Story location
      </Text>
      <Text style={{ marginTop: spacing.sm, color: colors.muted }}>
        Static map preview centered on {story.location.name}
      </Text>
      <View
        style={{
          marginTop: spacing.md,
          height: 160,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: colors.primary,
            marginBottom: spacing.sm,
          }}
        />
        <Text style={{ color: colors.text, fontWeight: '700' }}>{story.location.name}</Text>
        <Text style={{ marginTop: spacing.xs, color: colors.muted }}>
          {story.location.latitude.toFixed(4)}, {story.location.longitude.toFixed(4)}
        </Text>
      </View>
    </View>
  );
}

function CommentsSection({ story }: { story: StoryEntity }) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '700' }}>
        Comments
      </Text>
      <Text style={{ marginTop: spacing.sm, color: colors.muted }}>
        Comment posting will land with Issue 9. Existing discussion is shown below.
      </Text>
      {story.comments.map((comment) => (
        <View
          key={comment.id}
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '700' }}>{comment.authorName}</Text>
          <Text style={{ marginTop: spacing.xs, color: colors.muted, fontSize: typography.caption }}>
            {formatDate(comment.createdAt)}
          </Text>
          <Text style={{ marginTop: spacing.sm, color: colors.text }}>{comment.body}</Text>
        </View>
      ))}
    </View>
  );
}

export function StoryScreen({
  storyId,
  session,
  onRequestLogin,
  onGoBack,
  getStory = storyService.getStory,
}: StoryScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const [state, setState] = useState(() =>
    createInitialStoryDetailUiState(session?.role !== undefined && session.role !== roles.guest),
  );

  useEffect(() => {
    let isMounted = true;

    setState(createInitialStoryDetailUiState(session?.role !== undefined && session.role !== roles.guest));

    loadStoryDetail(storyId, session?.role, getStory).then((nextState) => {
      if (isMounted) {
        setState(nextState);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [getStory, session?.role, storyId]);

  const handleLikePress = () => {
    const result = toggleStoryLike(state);
    setState(result.nextState);

    if (result.requiresLogin) {
      onRequestLogin?.();
    }
  };

  if (state.isLoading) {
    return <Loader fullScreen message="Loading story..." />;
  }

  if (state.error === 'not-found') {
    return (
      <NotFoundPage
        title="Story not found"
        message="We couldn't find the story you were looking for."
        actionLabel="Back to stories"
        onGoBack={onGoBack}
      />
    );
  }

  if (state.error || !state.story) {
    return (
      <ErrorState
        fullScreen
        title="Story unavailable"
        message="We couldn't load this story right now. Please try again."
      />
    );
  }

  const story = state.story;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
        {story.title}
      </Text>

      <View
        style={{
          marginTop: spacing.lg,
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <StoryMetaRow label="Location" value={story.location.name} />
        <StoryMetaRow label="Time period" value={story.timePeriod} />
        <StoryMetaRow label="Contributor" value={story.contributorName} />
        <StoryMetaRow label="Submitted" value={formatDate(story.submittedAt)} />
      </View>

      {story.mediaUrl ? (
        <Image
          source={{ uri: story.mediaUrl }}
          style={{
            marginTop: spacing.xl,
            width: '100%',
            height: 220,
            borderRadius: 20,
            backgroundColor: colors.surface,
          }}
          accessibilityLabel={`${story.title} media`}
        />
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '700' }}>
          Full story
        </Text>
        {story.narrative.map((paragraph, index) => (
          <Text
            key={`${story.id}-paragraph-${index + 1}`}
            style={{
              marginTop: spacing.md,
              color: colors.text,
              fontSize: typography.body,
              lineHeight: 25,
            }}
          >
            {paragraph}
          </Text>
        ))}
      </View>

      <Pressable
        onPress={handleLikePress}
        style={{
          marginTop: spacing.xl,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: 999,
          alignSelf: 'flex-start',
          backgroundColor: story.likedByViewer ? colors.primary : colors.surface,
          borderWidth: 1,
          borderColor: colors.primary,
        }}
        accessibilityRole="button"
      >
        <Text
          style={{
            color: story.likedByViewer ? colors.background : colors.primary,
            fontWeight: '700',
          }}
        >
          {story.likedByViewer ? 'Unlike' : 'Like'} · {story.likeCount}
        </Text>
      </Pressable>

      {state.loginPromptVisible ? (
        <Text style={{ marginTop: spacing.sm, color: colors.muted }}>
          Log in to like this story.
        </Text>
      ) : null}

      <CommentsSection story={story} />
      <StoryMiniMap story={story} />
    </ScrollView>
  );
}
