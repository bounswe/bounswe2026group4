import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { FeedScreen } from '../FeedScreen';
import { FeedPageEntity } from '../../../domain/entities';
import { SearchFiltersProvider } from '../../../../search/presentation/context/SearchFiltersContext';
import { storage } from '../../../../../core/storage/storage';
import { geocodeLocationQuery, searchLocationSuggestions } from '../../../../search/application/services';

jest.mock('../../../../search/application/services', () => ({
  geocodeLocationQuery: jest.fn(),
  searchTags: jest.fn(async () => []),
  searchLocationSuggestions: jest.fn(),
}));

const istanbulBounds = { latMin: 40.8, latMax: 41.2, lngMin: 28.7, lngMax: 29.2 };

function makeStory(id: string, overrides: Partial<FeedPageEntity['items'][number]> = {}) {
  return {
    id,
    title: `Story ${id}`,
    locationName: `Location ${id}`,
    timePeriod: '1950s',
    previewText: 'A short preview about local history and memory.',
    submittedAt: '2026-03-18T10:00:00Z',
    hasMedia: false,
    likeCount: 0,
    savedByViewer: false,
    tags: [],
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
    (geocodeLocationQuery as jest.Mock).mockResolvedValue(null);
    (searchLocationSuggestions as jest.Mock).mockResolvedValue([]);
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ granted: true } as never);
    jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
    jest.mocked(Location.getLastKnownPositionAsync).mockResolvedValue(null);
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
      coords: {
        latitude: 41.0082,
        longitude: 28.9784,
      },
    } as never);
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
    renderScreen(
      <FeedScreen
        getFeed={async () =>
          makeFeedPage({ items: [makeStory('1', { tags: ['Harbor'] }), makeStory('2')] })
        }
      />,
    );

    expect(await screen.findByText('Story 1')).toBeTruthy();
    expect(screen.getByText('Story 2')).toBeTruthy();
    expect(screen.getByLabelText('Sort by Most Recent')).toBeTruthy();
    expect(screen.getByLabelText('Sort by Most Popular')).toBeTruthy();
    expect(screen.getByText('Recent')).toBeTruthy();
    expect(screen.getByText('Popular')).toBeTruthy();
    expect(screen.getByText('Harbor')).toBeTruthy();
    expect(screen.getByLabelText('Search stories')).toBeTruthy();
    expect(screen.queryByText('Story feed')).toBeNull();
  });

  it('opens a tag from a feed card', async () => {
    const onOpenTag = jest.fn();

    renderScreen(
      <FeedScreen
        getFeed={async () => makeFeedPage({ items: [makeStory('1', { tags: ['Harbor'] })] })}
        onOpenTag={onOpenTag}
      />,
    );

    expect(await screen.findByText('Story 1')).toBeTruthy();
    fireEvent.press(screen.getByTestId('feed-card-tag-Harbor'));

    expect(onOpenTag).toHaveBeenCalledWith('Harbor');
  });

  it('keeps sort controls visible when search controls are disabled', async () => {
    renderScreen(<FeedScreen getFeed={async () => makeFeedPage()} showSearchControls={false} />);

    expect(await screen.findByText('Story 1')).toBeTruthy();
    expect(screen.getByLabelText('Sort by Most Recent')).toBeTruthy();
    expect(screen.getByLabelText('Sort by Most Popular')).toBeTruthy();
    expect(screen.queryByLabelText('Search stories')).toBeNull();
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

  it('uses the provided initial sort for the first feed request', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(makeFeedPage());

    renderScreen(<FeedScreen getFeed={getFeed} initialSort="popular" />);

    await waitFor(() => {
      expect(getFeed).toHaveBeenCalledWith({
        page: 1,
        sort: 'popular',
        filters: {},
      });
    });
    expect(screen.getByLabelText('Sort by Most Popular').props.accessibilityState.selected).toBe(true);
  });

  it('switches to Most Popular and persists the selected sort in state', async () => {
    const onSortChange = jest.fn();
    const getFeed = jest
      .fn<Promise<FeedPageEntity>, [any]>()
      .mockResolvedValueOnce(makeFeedPage())
      .mockResolvedValueOnce(
        makeFeedPage({
          items: [
            makeStory('popular', { title: 'Popular Story', likeCount: 42 }),
            makeStory('quiet', { title: 'Quiet Story', likeCount: 3 }),
          ],
        }),
      );

    renderScreen(<FeedScreen getFeed={getFeed} onSortChange={onSortChange} />);

    expect(await screen.findByText('Story 1')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Sort by Most Popular'));

    await waitFor(() => {
      expect(getFeed).toHaveBeenLastCalledWith({
        page: 1,
        sort: 'popular',
        filters: {},
      });
    });

    expect(await screen.findByText('Popular Story')).toBeTruthy();
    expect(onSortChange).toHaveBeenCalledWith('popular');
    expect(screen.getByLabelText('Sort by Most Popular').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Sort by Most Recent').props.accessibilityState.selected).toBe(false);
  });

  it('applies story interaction updates to visible feed cards', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(
      makeFeedPage({
        items: [makeStory('1', { likeCount: 0, savedByViewer: false })],
        totalCount: 1,
      }),
    );
    const { rerender } = render(
      <SearchFiltersProvider>
        <FeedScreen getFeed={getFeed} storyInteractionUpdates={{}} />
      </SearchFiltersProvider>,
    );

    expect(await screen.findByText('♡ 0')).toBeTruthy();
    expect(screen.getByLabelText('Not bookmarked story')).toBeTruthy();

    rerender(
      <SearchFiltersProvider>
        <FeedScreen
          getFeed={getFeed}
          storyInteractionUpdates={{ '1': { likeCount: 1, savedByViewer: true } }}
        />
      </SearchFiltersProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('♥ 1')).toBeTruthy();
      expect(screen.getByLabelText('Bookmarked story')).toBeTruthy();
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
    (geocodeLocationQuery as jest.Mock).mockResolvedValueOnce(istanbulBounds);
    (searchLocationSuggestions as jest.Mock).mockResolvedValueOnce([
      { id: 'istanbul', title: 'Istanbul', subtitle: 'Turkiye', latitude: 41.0082, longitude: 28.9784, bounds: istanbulBounds },
    ]);

    renderScreen(<FeedScreen getFeed={getFeed} />);

    await screen.findByText('Story 1');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.changeText(screen.getByLabelText('Location filter'), 'Istanbul');
    fireEvent.changeText(screen.getByLabelText('Start year'), '1900');
    fireEvent.changeText(screen.getByLabelText('End year'), '1950');
    expect(await screen.findByText('Filtering by map area.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      expect(getFeed).toHaveBeenLastCalledWith({
        page: 1,
        sort: 'recent',
        filters: {
          q: undefined,
          location: 'Istanbul',
          locationBounds: istanbulBounds,
          yearFrom: 1900,
          yearTo: 1950,
        },
      });
    });

    expect(screen.getByLabelText('Remove Location: Istanbul')).toBeTruthy();
    expect(screen.getByLabelText('Remove From: 1900')).toBeTruthy();
    expect(screen.getByLabelText('Remove To: 1950')).toBeTruthy();
  });

  it('shows location suggestions and applies the selected place', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(makeFeedPage());
    const galataBounds = { latMin: 41.02, latMax: 41.04, lngMin: 28.96, lngMax: 28.99 };
    (geocodeLocationQuery as jest.Mock).mockResolvedValueOnce(null);
    (searchLocationSuggestions as jest.Mock).mockResolvedValueOnce([
      {
        id: 'galata',
        title: 'Galata',
        subtitle: 'Beyoglu, Istanbul',
        latitude: 41.0256,
        longitude: 28.9742,
        bounds: galataBounds,
      },
    ]);

    renderScreen(<FeedScreen getFeed={getFeed} />);

    await screen.findByText('Story 1');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.changeText(screen.getByLabelText('Location filter'), 'Galat');

    expect(await screen.findByTestId('location-filter-suggestions')).toBeTruthy();
    expect(screen.getByText('Galata')).toBeTruthy();
    expect(screen.getByText('Beyoglu, Istanbul')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Select location Galata'));
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      expect(getFeed).toHaveBeenLastCalledWith({
        page: 1,
        sort: 'recent',
        filters: {
          q: undefined,
          location: 'Galata',
          locationBounds: galataBounds,
          yearFrom: undefined,
          yearTo: undefined,
        },
      });
    });
  });

  it('does not apply placeholder year filters when submitted unchanged', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(makeFeedPage());

    renderScreen(<FeedScreen getFeed={getFeed} />);

    await screen.findByText('Story 1');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      expect(getFeed).toHaveBeenLastCalledWith({
        page: 1,
        sort: 'recent',
        filters: {
          q: undefined,
          location: undefined,
          yearFrom: undefined,
          yearTo: undefined,
        },
      });
    });
  });

  it('applies proximity filters with current coordinates', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(makeFeedPage());

    renderScreen(<FeedScreen getFeed={getFeed} />);

    await screen.findByText('Story 1');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.press(screen.getByLabelText('Distance 10 km'));

    expect(await screen.findByText('Filtering within 10 km of 41.0082, 28.9784.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      expect(getFeed).toHaveBeenLastCalledWith({
        page: 1,
        sort: 'recent',
        filters: {
          q: undefined,
          location: undefined,
          locationBounds: undefined,
          latitude: 41.0082,
          longitude: 28.9784,
          radiusKm: 10,
          yearFrom: undefined,
          yearTo: undefined,
        },
      });
    });

    expect(screen.getByLabelText('Remove Distance: 10 km')).toBeTruthy();
  });

  it('shows loading feedback while current location is fetched', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(makeFeedPage());
    jest.mocked(Location.getCurrentPositionAsync).mockReturnValue(new Promise(() => undefined) as never);

    renderScreen(<FeedScreen getFeed={getFeed} />);

    await screen.findByText('Story 1');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.press(screen.getByLabelText('Distance 1 km'));

    expect(await screen.findByText('Fetching your current location...')).toBeTruthy();
    expect(screen.getByLabelText('Fetching current location')).toBeTruthy();
    expect(screen.getByLabelText('Apply filters').props.accessibilityState.disabled).toBe(true);
  });

  it('shows an error when location permission is denied', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(makeFeedPage());
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ granted: false } as never);

    renderScreen(<FeedScreen getFeed={getFeed} />);

    await screen.findByText('Story 1');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.press(screen.getByLabelText('Distance 100 km'));

    expect(await screen.findByText('Location disabled. Enable location permission to use proximity filtering.')).toBeTruthy();
    expect(screen.getByLabelText('Apply filters').props.accessibilityState.disabled).toBe(true);
  });

  it('clears proximity filter state when the filter form is reset', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(makeFeedPage());

    renderScreen(<FeedScreen getFeed={getFeed} />);

    await screen.findByText('Story 1');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.press(screen.getByLabelText('Distance 10 km'));
    expect(await screen.findByText('Filtering within 10 km of 41.0082, 28.9784.')).toBeTruthy();

    fireEvent.press(screen.getByText('Reset filter form'));
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      expect(getFeed).toHaveBeenLastCalledWith({
        page: 1,
        sort: 'recent',
        filters: {
          q: undefined,
          location: undefined,
          locationBounds: undefined,
          yearFrom: undefined,
          yearTo: undefined,
        },
      });
    });

    expect(screen.queryByLabelText('Remove Distance: 10 km')).toBeNull();
  });

  it('closes the filter panel when tapping outside of it', async () => {
    renderScreen(<FeedScreen getFeed={async () => makeFeedPage()} />);

    await screen.findByText('Story 1');
    fireEvent.press(screen.getByText('Show filters'));

    expect(screen.getByText('Filters')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Close filters'));

    await waitFor(() => {
      expect(screen.queryByText('Filters')).toBeNull();
    });
  });

  it('resets only filter fields and preserves the search query', async () => {
    const getFeed = jest.fn<Promise<FeedPageEntity>, [any]>().mockResolvedValue(makeFeedPage());
    (geocodeLocationQuery as jest.Mock).mockResolvedValueOnce(istanbulBounds);

    renderScreen(<FeedScreen getFeed={getFeed} />);

    await screen.findByText('Story 1');
    fireEvent.changeText(screen.getByLabelText('Search stories'), 'harbor');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.changeText(screen.getByLabelText('Location filter'), 'Istanbul');
    fireEvent.changeText(screen.getByLabelText('Start year'), '1900');
    fireEvent.changeText(screen.getByLabelText('End year'), '1950');
    expect(await screen.findByText('Filtering by map area.')).toBeTruthy();
    fireEvent.press(screen.getByText('Reset filter form'));
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      expect(getFeed).toHaveBeenLastCalledWith({
        page: 1,
        sort: 'recent',
        filters: {
          q: 'harbor',
          location: undefined,
          locationBounds: undefined,
          yearFrom: undefined,
          yearTo: undefined,
        },
      });
    });

    expect(screen.getByLabelText('Search stories').props.value).toBe('harbor');
    expect(screen.queryByText('Location: Istanbul')).toBeNull();
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
