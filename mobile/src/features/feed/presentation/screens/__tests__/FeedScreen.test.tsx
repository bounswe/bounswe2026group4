import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { FeedScreen } from '../FeedScreen';
import { FeedPageEntity } from '../../../domain/entities';

function makeStory(id: string, overrides: Partial<FeedPageEntity['items'][number]> = {}) {
  return {
    id,
    title: `Story ${id}`,
    locationName: `Location ${id}`,
    timePeriod: '1950s',
    previewText: 'A short preview about local history and memory.',
    submittedAt: '2026-03-18T10:00:00Z',
    hasMedia: false,
    ...overrides,
  };
}

function makeFeedPage(overrides: Partial<FeedPageEntity> = {}): FeedPageEntity {
  return {
    items: [makeStory('1'), makeStory('2')],
    page: 1,
    pageSize: 10,
    totalCount: 2,
    hasNextPage: false,
    ...overrides,
  };
}

describe('FeedScreen', () => {
  it('shows loading skeletons while fetching', () => {
    const pendingPromise = new Promise<FeedPageEntity>(() => undefined);

    render(<FeedScreen getFeed={() => pendingPromise} />);

    expect(screen.getByLabelText('Loading stories')).toBeTruthy();
    expect(screen.queryByText('Story 1')).toBeNull();
  });

  it('renders story cards after a successful fetch', async () => {
    render(<FeedScreen getFeed={async () => makeFeedPage()} />);

    expect(await screen.findByText('Story 1')).toBeTruthy();
    expect(screen.getByText('Story 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sort: Most Recent' })).toBeTruthy();
    expect(screen.getByLabelText('Search stories')).toBeTruthy();
    expect(screen.queryByText('Story feed')).toBeNull();
  });

  it('shows an empty state when no stories are returned', async () => {
    render(<FeedScreen getFeed={async () => makeFeedPage({ items: [], totalCount: 0 })} />);

    expect(await screen.findByText('No stories yet')).toBeTruthy();
    expect(screen.getByText('Stories will appear here when published.')).toBeTruthy();
  });

  it('shows a filtered empty state when search is active and no stories match', async () => {
    render(<FeedScreen initialFilters={{ q: 'bridge' }} getFeed={async () => makeFeedPage({ items: [], totalCount: 0 })} />);

    expect(await screen.findByText('No results found')).toBeTruthy();
    expect(screen.getByText('Try adjusting your search or removing some filters.')).toBeTruthy();
  });

  it('loads the next page when the list reaches the end', async () => {
    const getFeed = jest
      .fn<Promise<FeedPageEntity>, [any]>()
      .mockResolvedValueOnce(makeFeedPage({ totalCount: 3, hasNextPage: true }))
      .mockResolvedValueOnce(
        makeFeedPage({
          items: [makeStory('3')],
          page: 2,
          totalCount: 3,
          hasNextPage: false,
        }),
      );

    render(<FeedScreen getFeed={getFeed} />);

    expect(await screen.findByText('Story 1')).toBeTruthy();
    fireEvent(screen.getByTestId('feed-list'), 'onEndReached');

    await waitFor(() => {
      expect(getFeed).toHaveBeenLastCalledWith({
        page: 2,
        sort: 'recent',
        filters: {},
      });
    });

    expect(await screen.findByText('Story 3')).toBeTruthy();
  });

  it('uses Most Recent as the default sort request', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(makeFeedPage());

    render(<FeedScreen getFeed={getFeed} />);

    await waitFor(() => {
      expect(getFeed).toHaveBeenCalledWith({
        page: 1,
        sort: 'recent',
        filters: {},
      });
    });
  });

  it('updates search query filters only after submit', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(makeFeedPage());

    render(<FeedScreen getFeed={getFeed} />);

    await screen.findByText('Story 1');
    fireEvent.changeText(screen.getByLabelText('Search stories'), 'harbor');

    expect(getFeed).toHaveBeenCalledTimes(1);

    fireEvent(screen.getByLabelText('Search stories'), 'submitEditing');

    await waitFor(() => {
      expect(getFeed).toHaveBeenLastCalledWith({
        page: 1,
        sort: 'recent',
        filters: {
          q: 'harbor',
          location: undefined,
          yearFrom: undefined,
          yearTo: undefined,
        },
      });
    });
  });

  it('applies search when the search button is pressed', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(makeFeedPage());

    render(<FeedScreen getFeed={getFeed} />);

    await screen.findByText('Story 1');
    fireEvent.changeText(screen.getByLabelText('Search stories'), 'market');
    fireEvent.press(screen.getByRole('button', { name: 'Apply search' }));

    await waitFor(() => {
      expect(getFeed).toHaveBeenLastCalledWith({
        page: 1,
        sort: 'recent',
        filters: {
          q: 'market',
          location: undefined,
          yearFrom: undefined,
          yearTo: undefined,
        },
      });
    });
  });

  it('updates advanced filters in feed requests', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(makeFeedPage());

    render(<FeedScreen getFeed={getFeed} />);

    await screen.findByText('Story 1');
    fireEvent.press(screen.getByText('Filters'));
    fireEvent.changeText(screen.getByLabelText('Filter by location'), 'Istanbul');
    fireEvent.changeText(screen.getByLabelText('Year from'), '1900');
    fireEvent.changeText(screen.getByLabelText('Year to'), '1950');
    fireEvent.press(screen.getByText('Apply filters'));

    await waitFor(() => {
      expect(getFeed).toHaveBeenLastCalledWith({
        page: 1,
        sort: 'recent',
        filters: {
          q: undefined,
          location: 'Istanbul',
          yearFrom: 1900,
          yearTo: 1950,
        },
      });
    });

    expect(screen.queryByText('Advanced filters')).toBeNull();
  });

  it('syncs draft filters from incoming initial filters', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(makeFeedPage());
    const { rerender } = render(<FeedScreen getFeed={getFeed} initialFilters={{ q: 'harbor' }} />);

    await screen.findByText('Story 1');
    expect(screen.getByLabelText('Search stories').props.value).toBe('harbor');

    rerender(<FeedScreen getFeed={getFeed} initialFilters={{ q: 'market', location: 'Istanbul' }} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Search stories').props.value).toBe('market');
    });
    fireEvent.press(screen.getByText('Filters'));
    expect(screen.getByLabelText('Filter by location').props.value).toBe('Istanbul');
  });

  it('opens story details when a card is pressed', async () => {
    const onOpenStory = jest.fn();

    render(<FeedScreen getFeed={async () => makeFeedPage()} onOpenStory={onOpenStory} />);

    expect(await screen.findByText('Story 1')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Read story: Story 1'));

    expect(onOpenStory).toHaveBeenCalledWith('1');
  });
});
