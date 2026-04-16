import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { roles } from '../../../../core/auth/roles';
import { Session } from '../../../../core/auth/session';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { interactionService } from '../../../interactions/application/services';
import { StoryCommentEntity } from '../../../interactions/domain/entities';
import { storyService } from '../../application/services';
import { StoryEntity } from '../../domain/entities';
import { ErrorState } from '../../../../shared/ui/ErrorState';
import { Button } from '../../../../shared/ui/Button';
import { Input } from '../../../../shared/ui/Input';
import { Loader } from '../../../../shared/ui/Loader';
import { NotFoundPage } from '../../../../shared/ui/NotFoundPage';
import { WebMapView } from '../../../../shared/components/WebMapView';
import { userService } from '../../../profile/application/services';
import { createInitialStoryDetailUiState } from '../state/storiesUiState';
import { loadStoryDetail } from '../state/storyDetailController';

interface StoryScreenProps {
  storyId: string;
  session?: Pick<Session, 'role' | 'user'>;
  onRequestLogin?: () => void;
  onGoBack?: () => void;
  onStoryDeleted?: () => void;
  onOpenContributorProfile?: (userId: string) => void;
  getStory?: typeof storyService.getStory;
  deleteStory?: typeof storyService.deleteStory;
  getPublicProfile?: typeof userService.getPublicProfile;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getResolvedContributorName(story: StoryEntity, session?: Pick<Session, 'user'>) {
  const isOwnStory =
    session?.user?.id !== undefined &&
    story.contributorUserId !== undefined &&
    String(session.user.id) === story.contributorUserId;

  if (isOwnStory && session?.user?.isUsernamePublic === false) {
    return 'Anonymous';
  }

  return story.contributorName;
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

function StoryMetaActionRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Open profile: ${value}` : undefined}
      disabled={!onPress}
      onPress={onPress}
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
          color: onPress ? colors.primary : colors.text,
          fontSize: typography.body,
          fontWeight: '600',
        }}
      >
        {value}
      </Text>
    </Pressable>
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
        Map preview centered on {story.location.name}
      </Text>
      <View
        style={{
          marginTop: spacing.md,
          height: 160,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          overflow: 'hidden',
        }}
      >
        <WebMapView
          region={{
            latitude: story.location.latitude,
            longitude: story.location.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          markers={[
            {
              id: story.id,
              latitude: story.location.latitude,
              longitude: story.location.longitude,
              selected: true,
              label: story.location.name,
            },
          ]}
          interactive={false}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: spacing.md,
            right: spacing.md,
            bottom: spacing.md,
            padding: spacing.sm,
            borderRadius: 14,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '700' }}>{story.location.name}</Text>
          <Text style={{ marginTop: spacing.xs, color: colors.muted }}>
            {story.location.latitude.toFixed(4)}, {story.location.longitude.toFixed(4)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function sortCommentsNewestFirst<T extends { createdAt: string }>(comments: T[]) {
  return [...comments].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function mapStoryCommentPreview(comment: StoryCommentEntity) {
  return {
    id: comment.id,
    authorName: comment.authorUsername || 'Anonymous',
    body: comment.text,
    createdAt: comment.createdAt,
  };
}

interface CommentsSectionProps {
  comments: StoryEntity['comments'];
  isAuthenticated: boolean;
  currentUsername?: string;
  loginPromptVisible: boolean;
  commentText: string;
  commentError?: string;
  deleteError?: string;
  confirmDeleteId?: string;
  isSubmitting: boolean;
  onChangeCommentText: (value: string) => void;
  onSubmitComment: () => void;
  onCommentLoginRequest: () => void;
  onDeleteRequest: (commentId: string) => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: (commentId: string) => void;
}

function CommentsSection({
  comments,
  isAuthenticated,
  currentUsername,
  loginPromptVisible,
  commentText,
  commentError,
  deleteError,
  confirmDeleteId,
  isSubmitting,
  onChangeCommentText,
  onSubmitComment,
  onCommentLoginRequest,
  onDeleteRequest,
  onDeleteCancel,
  onDeleteConfirm,
}: CommentsSectionProps) {
  const { colors, spacing, typography } = useAppTheme();
  const displayedComments = useMemo(() => sortCommentsNewestFirst(comments), [comments]);

  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '700' }}>
        Comments{comments.length > 0 ? ` (${comments.length})` : ''}
      </Text>
      {isAuthenticated ? (
        <View style={{ marginTop: spacing.md }}>
          <Input
            value={commentText}
            onChangeText={onChangeCommentText}
            placeholder="Write a comment..."
            accessibilityLabel="Comment input"
            editable={!isSubmitting}
            style={{ minHeight: 96, textAlignVertical: 'top' as const }}
          />
          {commentError ? (
            <Text style={{ marginTop: spacing.sm, color: colors.danger }}>{commentError}</Text>
          ) : null}
          <View style={{ marginTop: spacing.sm, alignItems: 'flex-end' }}>
            <Button onPress={onSubmitComment} disabled={isSubmitting || !commentText.trim()}>
              {isSubmitting ? 'Posting...' : 'Post comment'}
            </Button>
          </View>
        </View>
      ) : (
        <View style={{ marginTop: spacing.md }}>
          <Pressable onPress={onCommentLoginRequest} accessibilityRole="button">
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Log in to comment</Text>
          </Pressable>
          {loginPromptVisible ? (
            <Text style={{ marginTop: spacing.sm, color: colors.muted }}>
              Log in to comment on this story.
            </Text>
          ) : null}
        </View>
      )}

      {deleteError ? (
        <Text style={{ marginTop: spacing.sm, color: colors.danger }}>{deleteError}</Text>
      ) : null}

      {displayedComments.length === 0 ? (
        <Text style={{ marginTop: spacing.md, color: colors.muted }}>No comments yet. Be the first!</Text>
      ) : null}

      {displayedComments.map((comment) => {
        const isOwnComment = isAuthenticated && currentUsername === comment.authorName;
        const awaitingConfirm = confirmDeleteId === comment.id;

        return (
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
          {isOwnComment && !awaitingConfirm ? (
            <View style={{ marginTop: spacing.md, alignItems: 'flex-end' }}>
              <Pressable onPress={() => onDeleteRequest(comment.id)} accessibilityRole="button">
                <Text style={{ color: colors.danger, fontWeight: '700' }}>Delete comment</Text>
              </Pressable>
            </View>
          ) : null}
          {awaitingConfirm ? (
            <View
              style={{
                marginTop: spacing.md,
                padding: spacing.md,
                borderRadius: 14,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                gap: spacing.sm,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>Delete this comment?</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button onPress={() => onDeleteConfirm(comment.id)}>Delete</Button>
                <Button
                  onPress={onDeleteCancel}
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text>
                </Button>
              </View>
            </View>
          ) : null}
        </View>
        );
      })}
    </View>
  );
}

export function StoryScreen({
  storyId,
  session,
  onRequestLogin,
  onGoBack,
  onStoryDeleted,
  onOpenContributorProfile,
  getStory = storyService.getStory,
  deleteStory = storyService.deleteStory,
  getPublicProfile = userService.getPublicProfile,
}: StoryScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const [state, setState] = useState(() =>
    createInitialStoryDetailUiState(session?.role !== undefined && session.role !== roles.guest),
  );
  const [hasImageError, setHasImageError] = useState(false);
  const [comments, setComments] = useState<StoryEntity['comments']>([]);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();
  const [storyDeleteError, setStoryDeleteError] = useState<string>();
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [isStoryDeleting, setIsStoryDeleting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string>();
  const [interactionError, setInteractionError] = useState<string>();
  const [isContributorAnonymous, setIsContributorAnonymous] = useState(false);
  const deletedCommentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;

    setState(createInitialStoryDetailUiState(session?.role !== undefined && session.role !== roles.guest));
    setHasImageError(false);
    setComments([]);
    setCommentText('');
    setCommentError(undefined);
    setDeleteError(undefined);
    setStoryDeleteError(undefined);
    setConfirmDeleteId(undefined);
    setInteractionError(undefined);
    setIsContributorAnonymous(false);
    deletedCommentIdsRef.current = new Set();

    loadStoryDetail(storyId, session?.role, getStory).then((nextState) => {
      if (isMounted) {
        setState(nextState);
        setComments(
          sortCommentsNewestFirst(
            (nextState.story?.comments ?? [])
              .filter((comment) => !deletedCommentIdsRef.current.has(comment.id))
              .map((comment) => ({ ...comment })),
          ),
        );

        if (nextState.story) {
          interactionService
            .getComments(nextState.story.id)
            .then((remoteComments) => {
              if (!isMounted) {
                return;
              }

              setComments(
                sortCommentsNewestFirst(
                  remoteComments
                    .map(mapStoryCommentPreview)
                    .filter((comment) => !deletedCommentIdsRef.current.has(comment.id)),
                ),
              );
            })
            .catch(() => undefined);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [getStory, session?.role, storyId]);

  useEffect(() => {
    let isMounted = true;

    const story = state.story;
    if (!story?.contributorUserId) {
      setIsContributorAnonymous(story?.contributorName === 'Anonymous');
      return () => {
        isMounted = false;
      };
    }

    const isOwnPrivateStory =
      session?.user?.id !== undefined &&
      String(session.user.id) === story.contributorUserId &&
      session.user.isUsernamePublic === false;

    if (isOwnPrivateStory) {
      setIsContributorAnonymous(true);
      return () => {
        isMounted = false;
      };
    }

    setIsContributorAnonymous(story.contributorName === 'Anonymous');

    getPublicProfile(story.contributorUserId)
      .then((profile) => {
        if (!isMounted) {
          return;
        }

        setIsContributorAnonymous(!profile.username);
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [getPublicProfile, session?.user?.id, session?.user?.isUsernamePublic, state.story]);

  const extractInteractionError = (error: unknown, fallback: string) => {
    const response = (error as { response?: { data?: unknown } })?.response?.data;

    if (!response || typeof response !== 'object') {
      return error instanceof Error ? error.message : fallback;
    }

    const payload = response as Record<string, unknown>;

    if (typeof payload.detail === 'string') {
      return payload.detail;
    }

    if (typeof payload.message === 'string') {
      return payload.message;
    }

    for (const value of Object.values(payload)) {
      if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
      }

      if (typeof value === 'string') {
        return value;
      }
    }

    return fallback;
  };

  const handleLikePress = async () => {
    if (!state.story || state.isLikePending) {
      return;
    }

    if (!state.isAuthenticated) {
      setState((current) => ({
        ...current,
        loginPromptVisible: true,
      }));
      onRequestLogin?.();
      return;
    }

    const previousStory = state.story;
    const likedByViewer = !previousStory.likedByViewer;
    const likeCount = previousStory.likeCount + (likedByViewer ? 1 : -1);

    setInteractionError(undefined);
    setState((current) => ({
      ...current,
      isLikePending: true,
      loginPromptVisible: false,
      story: current.story
        ? {
            ...current.story,
            likedByViewer,
            likeCount,
          }
        : current.story,
    }));

    try {
      if (likedByViewer) {
        await interactionService.likeStory(previousStory.id);
      } else {
        await interactionService.unlikeStory(previousStory.id);
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        story: previousStory,
      }));
      setInteractionError(extractInteractionError(error, 'Failed to update like. Please try again.'));
    } finally {
      setState((current) => ({
        ...current,
        isLikePending: false,
      }));
    }
  };

  const handleCommentLoginRequest = () => {
    setState((current) => ({
      ...current,
      loginPromptVisible: true,
    }));
    onRequestLogin?.();
  };

  const handleSubmitComment = async () => {
    const trimmedText = commentText.trim();

    if (!state.story || !trimmedText || isCommentSubmitting) {
      return;
    }

    if (!state.isAuthenticated) {
      handleCommentLoginRequest();
      return;
    }

    setIsCommentSubmitting(true);
    setCommentError(undefined);

    try {
      const newComment = await interactionService.addComment(state.story.id, trimmedText);
      setComments((current) => [mapStoryCommentPreview(newComment), ...current]);
      setCommentText('');
    } catch (error) {
      setCommentError(extractInteractionError(error, 'Failed to post comment.'));
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setDeleteError(undefined);

    try {
      await interactionService.deleteComment(commentId);
      deletedCommentIdsRef.current.add(commentId);
      setComments((current) => current.filter((comment) => comment.id !== commentId));
    } catch (error) {
      setDeleteError(extractInteractionError(error, 'Failed to delete comment. Please try again.'));
    } finally {
      setConfirmDeleteId(undefined);
    }
  };

  const handleDeleteStory = async () => {
    if (!state.story || isStoryDeleting) {
      return;
    }

    setStoryDeleteError(undefined);
    setIsStoryDeleting(true);

    try {
      await deleteStory(state.story.id);
      onStoryDeleted?.();
    } catch (error) {
      setStoryDeleteError(extractInteractionError(error, 'Failed to delete story. Please try again.'));
    } finally {
      setIsStoryDeleting(false);
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
  const isStoryOwner = session?.user?.id !== undefined && String(session.user.id) === story.contributorUserId;
  const canDeleteStory = session?.role === roles.admin || isStoryOwner;
  const contributorName = isContributorAnonymous ? 'Anonymous' : getResolvedContributorName(story, session);
  const canOpenContributorProfile = Boolean(story.contributorUserId);

  const promptDeleteStory = () => {
    if (!canDeleteStory || isStoryDeleting) {
      return;
    }

    Alert.alert('Delete story?', 'This action permanently removes the story and cannot be undone.', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void handleDeleteStory();
        },
      },
    ]);
  };

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
      {canDeleteStory ? (
        <View style={{ marginTop: spacing.md, alignItems: 'flex-start' }}>
          <Button
            onPress={promptDeleteStory}
            disabled={isStoryDeleting}
            style={{ backgroundColor: colors.danger }}
          >
            {isStoryDeleting ? 'Deleting story...' : 'Delete story'}
          </Button>
        </View>
      ) : null}
      {storyDeleteError ? (
        <Text style={{ marginTop: spacing.sm, color: colors.danger }}>{storyDeleteError}</Text>
      ) : null}

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
        <StoryMetaActionRow
          label="Contributor"
          value={contributorName}
          onPress={
            canOpenContributorProfile
              ? () => {
                  onOpenContributorProfile?.(story.contributorUserId!);
                }
              : undefined
          }
        />
        <StoryMetaRow label="Submitted" value={formatDate(story.submittedAt)} />
      </View>

      {story.mediaUrl ? (
        hasImageError ? (
          <View
            style={{
              marginTop: spacing.xl,
              width: '100%',
              height: 220,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.lg,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>Story image unavailable</Text>
            <Text style={{ marginTop: spacing.sm, color: colors.muted, textAlign: 'center' }}>
              The image URL could not be loaded on this device.
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri: story.mediaUrl }}
            style={{
              marginTop: spacing.xl,
              width: '100%',
              height: 220,
              borderRadius: 20,
              backgroundColor: colors.surface,
            }}
            resizeMode="cover"
            accessibilityLabel={`${story.title} media`}
            onError={() => setHasImageError(true)}
          />
        )
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
        onPress={() => {
          void handleLikePress();
        }}
        disabled={state.isLikePending}
        style={{
          marginTop: spacing.xl,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: 999,
          alignSelf: 'flex-start',
          backgroundColor: story.likedByViewer ? colors.primary : colors.surface,
          borderWidth: 1,
          borderColor: colors.primary,
          opacity: state.isLikePending ? 0.7 : 1,
        }}
        accessibilityRole="button"
        accessibilityLabel={story.likedByViewer ? 'Unlike story' : 'Like story'}
        accessibilityState={{ disabled: state.isLikePending, selected: story.likedByViewer }}
      >
        <Text
          style={{
            color: story.likedByViewer ? colors.background : colors.primary,
            fontWeight: '700',
          }}
        >
          {story.likedByViewer ? '♥' : '♡'} {story.likeCount}
        </Text>
      </Pressable>

      {state.loginPromptVisible ? (
        <Text style={{ marginTop: spacing.sm, color: colors.muted }}>
          Log in to like or comment on this story.
        </Text>
      ) : null}
      {interactionError ? (
        <Text style={{ marginTop: spacing.sm, color: colors.danger }}>{interactionError}</Text>
      ) : null}

      <CommentsSection
        comments={comments}
        isAuthenticated={state.isAuthenticated}
        currentUsername={session?.user.username}
        loginPromptVisible={state.loginPromptVisible}
        commentText={commentText}
        commentError={commentError}
        deleteError={deleteError}
        confirmDeleteId={confirmDeleteId}
        isSubmitting={isCommentSubmitting}
        onChangeCommentText={(value) => {
          setCommentText(value);
          setCommentError(undefined);
        }}
        onSubmitComment={() => {
          void handleSubmitComment();
        }}
        onCommentLoginRequest={handleCommentLoginRequest}
        onDeleteRequest={(commentId) => {
          setDeleteError(undefined);
          setConfirmDeleteId(commentId);
        }}
        onDeleteCancel={() => setConfirmDeleteId(undefined)}
        onDeleteConfirm={(commentId) => {
          void handleDeleteComment(commentId);
        }}
      />
      <StoryMiniMap story={story} />
    </ScrollView>
  );
}
