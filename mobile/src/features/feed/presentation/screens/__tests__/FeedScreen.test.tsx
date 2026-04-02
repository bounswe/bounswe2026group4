import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { FeedScreen } from '../FeedScreen';
import { FeedPageEntity } from '../../../domain/entities';
import { SearchFiltersProvider } from '../../../../search/presentation/context/SearchFiltersContext';
import { storage } from '../../../../../core/storage/storage';

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
  beforeEach(async () => {
    await storage.clear();
  });

  function renderScreen(ui: React.ReactElement) {
    return render(<SearchFiltersProvider>{ui}</SearchFiltersProvider>);
  }

  it('shows loading skeletons while fetching', async () => {
    const pendingPromise = new Promise<FeedPageEntity>(() => undefined);

    renderScreen(<FeedScreen getFeed={() => pendingPromise} />);

    expect(await screen.findByLabelText('Loading stories')).toBeTruthy();
    expect(screen.queryByText('Story 1')).toBeNull();
  });

  it('renders story cards after a successful fetch', async () => {
    renderScreen(<FeedScreen getFeed={async () => makeFeedPage()} />);

    expect(await screen.findByText('Story 1')).toBeTruthy();
    expect(screen.getByText('Story 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sort: Most Recent' })).toBeTruthy();
    expect(screen.getByLabelText('Search stories')).toBeTruthy();
    expect(screen.queryByText('Story feed')).toBeNull();
  });

  it('shows an empty state when no stories are returned', async () => {
    renderScreen(<FeedScreen getFeed={async () => makeFeedPage({ items: [], totalCount: 0 })} />);

    expect(await screen.findByText('No stories yet')).toBeTruthy();
    expect(screen.getByText('Stories will appear here when published.')).toBeTruthy();
  });

  it('shows a filtered empty state when search is active and no stories match', async () => {
    renderScreen(<FeedScreen initialFilters={{ q: 'bridge' }} getFeed={async () => makeFeedPage({ items: [], totalCount: 0 })} />);

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

    renderScreen(<FeedScreen getFeed={getFeed} />);

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

    renderScreen(<FeedScreen getFeed={getFeed} />);

    await waitFor(() => {
      expect(getFeed).toHaveBeenCalledWith({
        page: 1,
        sort: 'recent',
        filters: {},
      });
    });
  });

  it('updates search query filters after debounce', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(makeFeedPage());

    renderScreen(<FeedScreen getFeed={getFeed} />);

    await screen.findByText('Story 1');
    fireEvent.changeText(screen.getByLabelText('Search stories'), 'harbor');

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

    renderScreen(<FeedScreen getFeed={getFeed} />);

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

    renderScreen(<FeedScreen getFeed={getFeed} />);

    await screen.findByText('Story 1');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.changeText(screen.getByLabelText('Location filter'), 'Istanbul');
    fireEvent.changeText(screen.getByLabelText('Start year'), '1900');
    fireEvent.changeText(screen.getByLabelText('End year'), '1950');
    fireEvent.press(screen.getByLabelText('Apply search'));

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

    expect(screen.getByText('Filters')).toBeTruthy();
  });

  it('syncs draft filters from incoming initial filters', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(makeFeedPage());
    const { rerender } = render(
      <SearchFiltersProvider>
        <FeedScreen getFeed={getFeed} initialFilters={{ q: 'harbor' }} />
      </SearchFiltersProvider>,
    );

    await screen.findByText('Story 1');
    expect(screen.getByLabelText('Search stories').props.value).toBe('harbor');

    rerender(
      <SearchFiltersProvider>
        <FeedScreen getFeed={getFeed} initialFilters={{ q: 'market', location: 'Istanbul' }} />
      </SearchFiltersProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Search stories').props.value).toBe('market');
    });
    fireEvent.press(screen.getByText('Show filters'));
    expect(screen.getByLabelText('Location filter').props.value).toBe('Istanbul');
  });

  it('opens story details when a card is pressed', async () => {
    const onOpenStory = jest.fn();

    renderScreen(<FeedScreen getFeed={async () => makeFeedPage()} onOpenStory={onOpenStory} />);

    expect(await screen.findByText('Story 1')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Read story: Story 1'));

    expect(onOpenStory).toHaveBeenCalledWith('1');
  });
});
