import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StoryScreen } from '../StoryScreen';
import { Session } from '../../../../../core/auth/session';
import { StoryEntity } from '../../../domain/entities';

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockMapView = ({ children, testID }: any) => <View testID={testID}>{children}</View>;
  const MockMarker = () => <View testID="story-location-marker" />;

  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
  };
});

const baseStory: StoryEntity = {
  id: 'story-001',
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
    expect(screen.getByText('18 Mar 2026')).toBeTruthy();
    expect(screen.getByText(baseStory.narrative[0])).toBeTruthy();
    expect(screen.getByText(baseStory.narrative[1])).toBeTruthy();
    expect(screen.getByLabelText(`${baseStory.title} media`)).toBeTruthy();
    expect(screen.getByText(baseStory.comments[0].body)).toBeTruthy();
    expect(screen.getByText('Story location')).toBeTruthy();
    expect(screen.getByTestId('story-location-map')).toBeTruthy();
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

    expect(await screen.findByText('Like · 27')).toBeTruthy();
    fireEvent.press(screen.getByText('Like · 27'));

    await waitFor(() => {
      expect(screen.getByText('Unlike · 28')).toBeTruthy();
    });
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

    expect(await screen.findByText('Like · 27')).toBeTruthy();
    fireEvent.press(screen.getByText('Like · 27'));

    await waitFor(() => {
      expect(screen.getByText('Log in to like this story.')).toBeTruthy();
    });
    expect(onRequestLogin).toHaveBeenCalledTimes(1);
  });

  it('renders the 404 state when the story does not exist', async () => {
    render(<StoryScreen storyId="missing-story" getStory={async () => null} />);

    expect(await screen.findByText('Story not found')).toBeTruthy();
    expect(screen.getByText("We couldn't find the story you were looking for.")).toBeTruthy();
  });
});
