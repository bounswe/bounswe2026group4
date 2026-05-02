import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FeedCard } from '../FeedCard';
import { FeedEntity } from '../../../domain/entities';

const story: FeedEntity = {
  id: 'story-101',
  title: 'The Ancient Bridge',
  locationName: 'Old City',
  timePeriod: '1453',
  previewText: 'Once upon a time there was a bridge that spanned the river in the heart of the old city.',
  submittedAt: '2026-03-18T10:00:00Z',
  hasMedia: true,
  likeCount: 14,
  savedByViewer: false,
};

describe('FeedCard', () => {
  it('renders the story fields and media indicator', () => {
    render(<FeedCard story={story} />);

    expect(screen.getByText('The Ancient Bridge')).toBeTruthy();
    expect(screen.getByText('Old City')).toBeTruthy();
    expect(screen.getByText('1453')).toBeTruthy();
    expect(screen.getByText('18 Mar 2026')).toBeTruthy();
    expect(screen.getByText('♥ 14')).toBeTruthy();
    expect(screen.getByText(story.previewText)).toBeTruthy();
    expect(screen.getByLabelText('Has media')).toBeTruthy();
    expect(screen.getByLabelText('Not bookmarked story')).toBeTruthy();
  });

  it('navigates when the card is pressed', () => {
    const onPress = jest.fn();

    render(<FeedCard story={story} onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Read story: The Ancient Bridge'));

    expect(onPress).toHaveBeenCalledWith('story-101');
  });

  it('hides the media indicator when the story has no media', () => {
    render(<FeedCard story={{ ...story, hasMedia: false }} />);

    expect(screen.queryByLabelText('Has media')).toBeNull();
  });

  it('renders the filled bookmark indicator for saved stories', () => {
    render(<FeedCard story={{ ...story, savedByViewer: true }} />);

    expect(screen.getByLabelText('Bookmarked story')).toBeTruthy();
    expect(screen.queryByLabelText('Not bookmarked story')).toBeNull();
  });

  it('calls the bookmark handler from the card bookmark button', () => {
    const onPress = jest.fn();
    const onBookmarkPress = jest.fn();

    render(<FeedCard story={story} onPress={onPress} onBookmarkPress={onBookmarkPress} />);

    fireEvent.press(screen.getByLabelText('Not bookmarked story'));

    expect(onBookmarkPress).toHaveBeenCalledWith('story-101');
    expect(onPress).not.toHaveBeenCalled();
  });
});
