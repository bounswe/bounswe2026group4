import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StoryScreen } from '../StoryScreen';
import { Session } from '../../../../../core/auth/session';
import { StoryEntity } from '../../../domain/entities';
import { interactionService } from '../../../../interactions/application/services';

jest.mock('../../../../../shared/components/WebMapView', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    WebMapView: () => <View testID="story-location-map" />,
  };
});

jest.mock('../../../../interactions/application/services', () => ({
  interactionService: {
    likeStory: jest.fn(async () => undefined),
    unlikeStory: jest.fn(async () => undefined),
    getComments: jest.fn(async () => []),
    addComment: jest.fn(async () => undefined),
    deleteComment: jest.fn(async () => undefined),
  },
}));

const baseStory: StoryEntity = {
  id: 'story-001',
  contributorUserId: '22',
  title: 'The Day the Harbor Fell Silent',
  narrative: [
    'By dusk, the harbor had stopped sounding like work and started sounding like memory.',
    'Today, the old quay is a promenade.',
  ],
  status: 'published',
  location: {
    name: 'Golden Horn Docklands',
    latitude: 41.0284,
    longitude: 28.9647,
  },
  timePeriod: 'Late 1970s',
  contributorName: 'Aylin Demir',
  submittedAt: '2026-03-18',
  mediaUrl: 'https://example.com/story.jpg',
  tags: ['Harbor', 'Labor'],
  likeCount: 27,
  likedByViewer: false,
  comments: [
    {
      id: 'comment-1',
      authorName: 'Mert Kaya',
      body: 'My grandfather worked here for thirty years.',
      createdAt: '2026-03-20',
    },
  ],
};

describe('StoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (interactionService.getComments as jest.Mock).mockResolvedValue(
      baseStory.comments.map((comment) => ({
        id: comment.id,
        authorUsername: comment.authorName,
        text: comment.body,
        createdAt: comment.createdAt,
      })),
    );
  });

  const userSession: Session = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    role: 'user',
    user: {
      id: 1,
      email: 'traveler@example.com',
      username: 'Traveler',
      role: 'user',
    },
  };

  const guestSession: Session = {
    accessToken: '',
    refreshToken: '',
    role: 'guest',
    user: {
      id: 0,
      email: 'guest@example.com',
      username: 'Guest',
      role: 'guest',
    },
  };

  const ownerSession: Session = {
    ...userSession,
    user: {
      ...userSession.user,
      id: 22,
      username: 'Aylin Demir',
    },
  };

  const adminSession: Session = {
    ...userSession,
    role: 'admin',
    user: {
      ...userSession.user,
      role: 'admin',
    },
  };
  it('renders loading state while fetching the story', () => {
    const pendingPromise = new Promise<StoryEntity | null>(() => undefined);

    render(<StoryScreen storyId="story-001" getStory={() => pendingPromise} />);

    expect(screen.getByText('Loading story...')).toBeTruthy();
  });

  it('renders the full narrative, metadata, media, and comments', async () => {
    render(<StoryScreen storyId="story-001" getStory={async () => baseStory} />);

    expect(await screen.findByText(baseStory.title)).toBeTruthy();
    expect(screen.getAllByText(baseStory.location.name)).toHaveLength(2);
    expect(screen.getByText(baseStory.timePeriod)).toBeTruthy();
    expect(screen.getByText(baseStory.contributorName)).toBeTruthy();
    expect(screen.getByText('Date added: 18 Mar 2026')).toBeTruthy();
    expect(screen.getByText('1 min read')).toBeTruthy();
    expect(screen.getByText('Harbor')).toBeTruthy();
    expect(screen.getByText('Labor')).toBeTruthy();
    expect(screen.getByText(baseStory.narrative[0])).toBeTruthy();
    expect(screen.getByText(baseStory.narrative[1])).toBeTruthy();
    expect(screen.getByLabelText(`${baseStory.title} media`)).toBeTruthy();
    expect(screen.getByText(baseStory.comments[0].body)).toBeTruthy();
    expect(screen.getByText('Story location')).toBeTruthy();
    expect(screen.getByTestId('story-location-map')).toBeTruthy();
  });

  it('opens the contributor profile when the contributor name is pressed', async () => {
    const onOpenContributorProfile = jest.fn();

    render(
      <StoryScreen
        storyId="story-001"
        getStory={async () => baseStory}
        getPublicProfile={async () => ({ id: '22', username: 'Aylin Demir', totalPoints: 0 })}
        onOpenContributorProfile={onOpenContributorProfile}
      />,
    );

    expect(await screen.findByText(baseStory.title)).toBeTruthy();
    fireEvent.press(screen.getByLabelText(`Open profile: ${baseStory.contributorName}`));

    expect(onOpenContributorProfile).toHaveBeenCalledWith('22');
  });

  it('opens a tag from story detail', async () => {
    const onOpenTag = jest.fn();

    render(
      <StoryScreen
        storyId="story-001"
        getStory={async () => baseStory}
        onOpenTag={onOpenTag}
      />,
    );

    expect(await screen.findByText(baseStory.title)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Harbor'));

    expect(onOpenTag).toHaveBeenCalledWith('Harbor');
  });

  it('shows the contributor profile photo when public profile metadata includes one', async () => {
    render(
      <StoryScreen
        storyId="story-001"
        getStory={async () => baseStory}
        getPublicProfile={async () => ({
          id: '22',
          username: 'Aylin Demir',
          totalPoints: 0,
          profilePhoto: 'https://example.com/profile.jpg',
        })}
      />,
    );

    expect(await screen.findByText(baseStory.title)).toBeTruthy();
    expect(await screen.findByLabelText(`${baseStory.contributorName} profile photo`)).toBeTruthy();
  });

  it('keeps the profile action for anonymous contributor fallbacks', async () => {
    const onOpenContributorProfile = jest.fn();

    render(
      <StoryScreen
        storyId="story-001"
        getStory={async () => ({
          ...baseStory,
          contributorName: 'Anonymous',
        })}
        getPublicProfile={async () => ({ id: '22', username: null, totalPoints: 0 })}
        onOpenContributorProfile={onOpenContributorProfile}
      />,
    );

    expect(await screen.findByText(baseStory.title)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open profile: Anonymous'));
    expect(onOpenContributorProfile).toHaveBeenCalledWith('22');
  });

  it('shows deleted user when the story belongs to a deleted account', async () => {
    render(
      <StoryScreen
        storyId="story-001"
        getStory={async () => ({
          ...baseStory,
          contributorUserId: undefined,
          contributorName: 'Deleted user',
        })}
      />,
    );

    expect(await screen.findByText(baseStory.title)).toBeTruthy();
    expect(screen.getByText('Deleted user')).toBeTruthy();
    expect(screen.queryByLabelText('Open profile: Deleted user')).toBeNull();
  });

  it('uses backend temporal coverage metadata when present', async () => {
    render(
      <StoryScreen
        storyId="story-001"
        getStory={async () => ({
          ...baseStory,
          timePeriod: 'Late 1970s',
          temporalCoverageIso8601: '1970/1979',
        })}
      />,
    );

    expect(await screen.findByText(baseStory.title)).toBeTruthy();
    expect(screen.getByText('1970/1979')).toBeTruthy();
    expect(screen.queryByText('Late 1970s')).toBeNull();
  });

  it('shows anonymous contributor label for anonymous stories without profile action', async () => {
    render(
      <StoryScreen
        storyId="story-001"
        getStory={async () => ({
          ...baseStory,
          contributorUserId: '22',
          contributorName: 'Anonymous',
          isContributorAnonymous: true,
        })}
      />,
    );

    expect(await screen.findByText(baseStory.title)).toBeTruthy();
    expect(screen.queryByLabelText(/Open profile:/)).toBeNull();
    expect(screen.getByText('Anonymous')).toBeTruthy();
  });

  it('renders safely without optional media and tags', async () => {
    render(
      <StoryScreen
        storyId="story-001"
        getStory={async () => ({
          ...baseStory,
          mediaUrl: undefined,
          tags: [],
        })}
      />,
    );

    expect(await screen.findByText(baseStory.title)).toBeTruthy();
    expect(screen.queryByLabelText(`${baseStory.title} media`)).toBeNull();
    expect(screen.queryByText('Harbor')).toBeNull();
  });

  it('shows deleted account for anonymized comments from deleted users', async () => {
    (interactionService.getComments as jest.Mock).mockResolvedValueOnce([
      {
        id: 'comment-deleted',
        authorUsername: null,
        text: 'I used to work there too.',
        createdAt: '2026-03-20T12:00:00Z',
        isAnonymized: true,
        is_anonymized: true,
      },
    ]);

    render(
      <StoryScreen
        storyId="story-001"
        getStory={async () => ({
          ...baseStory,
          comments: [],
        })}
      />,
    );

    await screen.findByText(baseStory.title);
    expect(await screen.findByText('Deleted account')).toBeTruthy();
    expect(screen.getByText('I used to work there too.')).toBeTruthy();
  });

  it('marks the signed-in user on their own story even if their username is private', async () => {
    render(
      <StoryScreen
        storyId="story-001"
        session={{
          ...ownerSession,
          user: {
            ...ownerSession.user,
            isUsernamePublic: false,
          },
        }}
        getStory={async () => baseStory}
        getPublicProfile={async () => ({ id: '22', username: null, totalPoints: 0 })}
      />,
    );

    expect(await screen.findByText(baseStory.title)).toBeTruthy();
    expect(screen.getByText(`${baseStory.contributorName} (You)`)).toBeTruthy();
    expect(screen.queryByText('Anonymous')).toBeNull();
    expect(screen.getByLabelText(`Open profile: ${baseStory.contributorName} (You)`)).toBeTruthy();
  });

  it('uses the contributor public profile to hide private usernames', async () => {
    render(
      <StoryScreen
        storyId="story-001"
        getStory={async () => baseStory}
        getPublicProfile={async () => ({ id: '22', username: null, totalPoints: 0 })}
      />,
    );

    expect(await screen.findByText(baseStory.title)).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('Anonymous')).toBeTruthy();
    });
    expect(screen.queryByText(baseStory.contributorName)).toBeNull();
    expect(screen.getByLabelText('Open profile: Anonymous')).toBeTruthy();
  });

  it('shows an image fallback message when the media fails to load', async () => {
    render(<StoryScreen storyId="story-001" getStory={async () => baseStory} />);

    const image = await screen.findByLabelText(`${baseStory.title} media`);
    fireEvent(image, 'error');

    await waitFor(() => {
      expect(screen.getByText('Story image unavailable')).toBeTruthy();
    });
  });

  it('toggles likes for authenticated users', async () => {
    render(
      <StoryScreen
        storyId="story-001"
        session={userSession}
        getStory={async () => baseStory}
      />,
    );

    expect(await screen.findByText('♡ 27')).toBeTruthy();
    fireEvent.press(screen.getByText('♡ 27'));

    await waitFor(() => {
      expect(screen.getByText('♥ 28')).toBeTruthy();
    });
    expect(interactionService.likeStory).toHaveBeenCalledWith('story-001');
  });

  it('prompts unauthenticated users to log in before liking', async () => {
    const onRequestLogin = jest.fn();

    render(
      <StoryScreen
        storyId="story-001"
        session={guestSession}
        onRequestLogin={onRequestLogin}
        getStory={async () => baseStory}
      />,
    );

    expect(await screen.findByText('♡ 27')).toBeTruthy();
    fireEvent.press(screen.getByText('♡ 27'));

    await waitFor(() => {
      expect(screen.getByText('Log in to like or comment on this story.')).toBeTruthy();
    });
    expect(onRequestLogin).toHaveBeenCalledTimes(1);
  });

  it('reverts optimistic likes when the API request fails', async () => {
    (interactionService.likeStory as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(
      <StoryScreen
        storyId="story-001"
        session={userSession}
        getStory={async () => baseStory}
      />,
    );

    expect(await screen.findByText('♡ 27')).toBeTruthy();
    fireEvent.press(screen.getByText('♡ 27'));

    await waitFor(() => {
      expect(screen.getByText('♡ 27')).toBeTruthy();
      expect(screen.getByText('Network error')).toBeTruthy();
    });
  });

  it('renders comments in most recent first order', async () => {
    (interactionService.getComments as jest.Mock).mockResolvedValueOnce([
      {
        id: 'comment-older',
        authorUsername: 'Older User',
        text: 'Older comment',
        createdAt: '2026-03-19T12:00:00Z',
      },
      {
        id: 'comment-newer',
        authorUsername: 'Newer User',
        text: 'Newest comment',
        createdAt: '2026-03-20T12:00:00Z',
      },
    ]);

    render(
      <StoryScreen
        storyId="story-001"
        session={userSession}
        getStory={async () => ({
          ...baseStory,
          comments: [
            {
              id: 'comment-older',
              authorName: 'Older User',
              body: 'Older comment',
              createdAt: '2026-03-19T12:00:00Z',
            },
            {
              id: 'comment-newer',
              authorName: 'Newer User',
              body: 'Newest comment',
              createdAt: '2026-03-20T12:00:00Z',
            },
          ],
        })}
      />,
    );

    await screen.findByText('Newest comment');
    const comments = screen.getAllByText(/Newest comment|Older comment/);

    expect(comments[0]).toHaveTextContent('Newest comment');
    expect(comments[1]).toHaveTextContent('Older comment');
  });

  it('submits a new comment and shows it at the top', async () => {
    (interactionService.addComment as jest.Mock).mockResolvedValueOnce({
      id: 'comment-99',
      authorUsername: 'Traveler',
      text: 'My new comment',
      createdAt: '2026-03-21T12:00:00Z',
    });

    render(
      <StoryScreen
        storyId="story-001"
        session={userSession}
        getStory={async () => baseStory}
      />,
    );

    await screen.findByText(baseStory.title);
    fireEvent.changeText(screen.getByLabelText('Comment input'), 'My new comment');
    fireEvent.press(screen.getByText('Post comment'));

    await waitFor(() => {
      expect(interactionService.addComment).toHaveBeenCalledWith('story-001', 'My new comment');
      expect(screen.getByText('Comments (2)')).toBeTruthy();
    });

    const comments = screen.getAllByText(/My new comment|My grandfather worked here for thirty years\./);
    expect(comments[0]).toHaveTextContent('My new comment');
  });

  it('shows delete controls only for the user’s own comments and deletes after confirmation', async () => {
    (interactionService.deleteComment as jest.Mock).mockResolvedValueOnce(undefined);
    (interactionService.getComments as jest.Mock).mockResolvedValueOnce([
      {
        id: 'comment-own',
        authorUsername: 'Traveler',
        text: 'My own comment',
        createdAt: '2026-03-21T12:00:00Z',
      },
      {
        id: 'comment-other',
        authorUsername: 'Someone else',
        text: 'Another comment',
        createdAt: '2026-03-20T12:00:00Z',
      },
    ]);

    render(
      <StoryScreen
        storyId="story-001"
        session={userSession}
        getStory={async () => ({
          ...baseStory,
          comments: [
            {
              id: 'comment-own',
              authorName: 'Traveler',
              body: 'My own comment',
              createdAt: '2026-03-21T12:00:00Z',
            },
            {
              id: 'comment-other',
              authorName: 'Someone else',
              body: 'Another comment',
              createdAt: '2026-03-20T12:00:00Z',
            },
          ],
        })}
      />,
    );

    await screen.findByText('My own comment');
    expect(screen.getByText('Delete comment')).toBeTruthy();
    expect(screen.queryAllByText('Delete comment')).toHaveLength(1);

    fireEvent.press(screen.getByText('Delete comment'));
    expect(screen.getByText('Delete this comment?')).toBeTruthy();

    fireEvent.press(screen.getByText('Delete'));

    await waitFor(() => {
      expect(interactionService.deleteComment).toHaveBeenCalledWith('comment-own');
    });

    await waitFor(() => {
      expect(screen.queryByText('Delete this comment?')).toBeNull();
    });
  });

  it('marks the signed-in user on their own comments even when private', async () => {
    (interactionService.getComments as jest.Mock).mockResolvedValueOnce([
      {
        id: 'comment-own',
        authorUsername: 'Traveler',
        text: 'My own comment',
        createdAt: '2026-03-21T12:00:00Z',
      },
    ]);

    render(
      <StoryScreen
        storyId="story-001"
        session={{
          ...userSession,
          user: {
            ...userSession.user,
            isUsernamePublic: false,
          },
        }}
        getStory={async () => ({
          ...baseStory,
          comments: [
            {
              id: 'comment-own',
              authorName: 'Traveler',
              body: 'My own comment',
              createdAt: '2026-03-21T12:00:00Z',
            },
          ],
        })}
      />,
    );

    await screen.findByText('My own comment');
    expect(screen.getByText('Traveler (You)')).toBeTruthy();
    expect(screen.queryByText('Anonymous')).toBeNull();
    expect(screen.getByText('Delete comment')).toBeTruthy();
  });

  it('shows the delete story action only to the owner or an admin', async () => {
    const { rerender } = render(
      <StoryScreen
        storyId="story-001"
        session={userSession}
        getStory={async () => baseStory}
      />,
    );

    await screen.findByText(baseStory.title);
    expect(screen.queryByText('Delete story')).toBeNull();
    expect(screen.queryByLabelText('Delete story')).toBeNull();

    rerender(
      <StoryScreen
        storyId="story-001"
        session={ownerSession}
        getStory={async () => baseStory}
      />,
    );

    expect(await screen.findByLabelText('Delete story')).toBeTruthy();

    rerender(
      <StoryScreen
        storyId="story-001"
        session={adminSession}
        getStory={async () => baseStory}
      />,
    );

    expect(await screen.findByLabelText('Delete story')).toBeTruthy();
  });

  it('confirms and deletes the story for authorized users', async () => {
    const deleteStory = jest.fn(async () => undefined);
    const onStoryDeleted = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    render(
      <StoryScreen
        storyId="story-001"
        session={ownerSession}
        getStory={async () => baseStory}
        deleteStory={deleteStory}
        onStoryDeleted={onStoryDeleted}
      />,
    );

    fireEvent.press(await screen.findByLabelText('Delete story'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete story?',
      'This action permanently removes the story and cannot be undone.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Delete', style: 'destructive', onPress: expect.any(Function) }),
      ]),
    );

    const buttons = alertSpy.mock.calls[0]?.[2];
    const deleteButton = buttons?.find((button) => button.text === 'Delete');

    await act(async () => {
      deleteButton?.onPress?.();
    });

    await waitFor(() => {
      expect(deleteStory).toHaveBeenCalledWith('story-001');
      expect(onStoryDeleted).toHaveBeenCalledTimes(1);
    });

    alertSpy.mockRestore();
  });

  it('shows a meaningful error when story deletion fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    render(
      <StoryScreen
        storyId="story-001"
        session={ownerSession}
        getStory={async () => baseStory}
        deleteStory={jest.fn(async () => {
          throw new Error('Deletion failed on server');
        })}
      />,
    );

    fireEvent.press(await screen.findByLabelText('Delete story'));

    const buttons = alertSpy.mock.calls[0]?.[2];
    const deleteButton = buttons?.find((button) => button.text === 'Delete');

    await act(async () => {
      deleteButton?.onPress?.();
    });

    expect(await screen.findByText('Deletion failed on server')).toBeTruthy();

    alertSpy.mockRestore();
  });

  it('collapses long narratives and expands them on request', async () => {
    const longStory = {
      ...baseStory,
      narrative: [
        'The first paragraph sets the scene beside the water.',
        'The second paragraph gives enough detail to preview the story without overwhelming the screen.',
        'The third paragraph should stay hidden until the reader asks for the full story.',
      ],
    };

    render(<StoryScreen storyId="story-001" getStory={async () => longStory} />);

    expect(await screen.findByText(longStory.title)).toBeTruthy();
    expect(screen.getByText(longStory.narrative[0])).toBeTruthy();
    expect(screen.getByText(longStory.narrative[1])).toBeTruthy();
    expect(screen.queryByText(longStory.narrative[2])).toBeNull();

    fireEvent.press(screen.getByText('Read more'));

    expect(screen.getByText(longStory.narrative[2])).toBeTruthy();
    expect(screen.getByText('Show less')).toBeTruthy();

    fireEvent.press(screen.getByText('Show less'));

    expect(screen.queryByText(longStory.narrative[2])).toBeNull();
    expect(screen.getByText('Read more')).toBeTruthy();
  });

  it('prompts unauthenticated users when they try to comment', async () => {
    const onRequestLogin = jest.fn();

    render(
      <StoryScreen
        storyId="story-001"
        session={guestSession}
        onRequestLogin={onRequestLogin}
        getStory={async () => baseStory}
      />,
    );

    await screen.findByText(baseStory.title);
    fireEvent.press(screen.getByText('Log in to comment'));

    await waitFor(() => {
      expect(screen.getByText('Log in to comment on this story.')).toBeTruthy();
    });
    expect(onRequestLogin).toHaveBeenCalledTimes(1);
  });

  it('renders the 404 state when the story does not exist', async () => {
    render(<StoryScreen storyId="missing-story" getStory={async () => null} />);

    expect(await screen.findByText('Story not found')).toBeTruthy();
    expect(screen.getByText("We couldn't find the story you were looking for.")).toBeTruthy();
  });
});
