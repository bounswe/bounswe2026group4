import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { storage } from '../../../../../core/storage/storage';
import { TimelinePageEntity } from '../../../domain/entities';
import { SearchFiltersProvider } from '../../../../search/presentation/context/SearchFiltersContext';
import { geocodeLocationQuery, searchLocationSuggestions } from '../../../../search/application/services';
import { TimelineScreen } from '../TimelineScreen';

jest.mock('../../../../search/application/services', () => ({
  geocodeLocationQuery: jest.fn(),
  searchLocationSuggestions: jest.fn(),
}));

const istanbulBounds = { latMin: 40.8, latMax: 41.2, lngMin: 28.7, lngMax: 29.2 };

function makeStory(id: string, overrides: Partial<TimelinePageEntity['items'][number]> = {}) {
  return {
    id,
    title: `Timeline Story ${id}`,
    timeType: 'exact_year',
    timePeriod: '1950',
    temporalCoverage: '1950',
    historicalYear: 1950,
    year: 1950,
    locationName: `Location ${id}`,
    latitude: 41.0082,
    longitude: 28.9784,
    ...overrides,
  };
}

function makeTimelinePage(overrides: Partial<TimelinePageEntity> = {}): TimelinePageEntity {
  return {
    items: [makeStory('1'), makeStory('2')],
    page: 1,
    pageSize: 10,
    totalCount: 2,
    hasNextPage: false,
    ...overrides,
  };
}

describe('TimelineScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (geocodeLocationQuery as jest.Mock).mockResolvedValue(null);
    (searchLocationSuggestions as jest.Mock).mockResolvedValue([]);
    await storage.clear();
  });

  function renderScreen(ui: React.ReactElement) {
    return render(<SearchFiltersProvider>{ui}</SearchFiltersProvider>);
  }

  it('shows loading skeletons while fetching timeline stories', async () => {
    const pendingPromise = new Promise<TimelinePageEntity>(() => undefined);

    renderScreen(<TimelineScreen getTimeline={() => pendingPromise} showSearchControls={false} />);

    expect(await screen.findByLabelText('Loading timeline stories')).toBeTruthy();
  });

  it('renders timeline cards and opens story detail', async () => {
    const onOpenStory = jest.fn();

    renderScreen(
      <TimelineScreen
        getTimeline={async () => makeTimelinePage()}
        onOpenStory={onOpenStory}
        showSearchControls={false}
      />,
    );

    expect(await screen.findByText('Timeline Story 1')).toBeTruthy();
    expect(screen.getByText('Choose a time window')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open timeline story: Timeline Story 1'));

    expect(onOpenStory).toHaveBeenCalledWith('1');
  });

  it('applies quick decade selection to timeline requests', async () => {
    const getTimeline = jest.fn<Promise<TimelinePageEntity>, [any]>().mockResolvedValue(makeTimelinePage());

    renderScreen(<TimelineScreen getTimeline={getTimeline} showSearchControls={false} />);

    await screen.findByText('Timeline Story 1');
    fireEvent.press(screen.getByLabelText('Select period 1920s'));

    await waitFor(() => {
      expect(getTimeline).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          decade: 1920,
        }),
      );
    });
    expect(screen.getAllByText('1920s').length).toBeGreaterThan(0);
  });

  it('loads the next timeline page when the list reaches the end', async () => {
    const getTimeline = jest
      .fn<Promise<TimelinePageEntity>, [any]>()
      .mockResolvedValueOnce(makeTimelinePage({ totalCount: 3, hasNextPage: true }))
      .mockResolvedValueOnce(
        makeTimelinePage({
          items: [makeStory('3', { title: 'Timeline Story 3' })],
          page: 2,
          totalCount: 3,
          hasNextPage: false,
        }),
      );

    renderScreen(<TimelineScreen getTimeline={getTimeline} showSearchControls={false} />);

    expect(await screen.findByText('Timeline Story 1')).toBeTruthy();
    fireEvent(screen.getByTestId('timeline-list'), 'onEndReached');

    await waitFor(() => {
      expect(getTimeline).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 2,
        }),
      );
    });
    expect(await screen.findByText('Timeline Story 3')).toBeTruthy();
  });

  it('does not render duplicate timeline stories when pages repeat an id', async () => {
    const getTimeline = jest
      .fn<Promise<TimelinePageEntity>, [any]>()
      .mockResolvedValueOnce(
        makeTimelinePage({
          items: [
            makeStory('38', { title: 'Repeated Story' }),
            makeStory('38', { title: 'Repeated Story' }),
          ],
          totalCount: 2,
          hasNextPage: true,
        }),
      )
      .mockResolvedValueOnce(
        makeTimelinePage({
          items: [
            makeStory('38', { title: 'Repeated Story' }),
            makeStory('39', { title: 'Fresh Story' }),
          ],
          page: 2,
          totalCount: 3,
          hasNextPage: false,
        }),
      );

    renderScreen(<TimelineScreen getTimeline={getTimeline} showSearchControls={false} />);

    expect(await screen.findAllByText('Repeated Story')).toHaveLength(1);
    fireEvent(screen.getByTestId('timeline-list'), 'onEndReached');

    expect(await screen.findByText('Fresh Story')).toBeTruthy();
    expect(screen.getAllByText('Repeated Story')).toHaveLength(1);
  });

  it('updates shared location filters in timeline requests', async () => {
    const getTimeline = jest.fn<Promise<TimelinePageEntity>, [any]>().mockResolvedValue(makeTimelinePage());
    (geocodeLocationQuery as jest.Mock).mockResolvedValueOnce(istanbulBounds);
    (searchLocationSuggestions as jest.Mock).mockResolvedValueOnce([
      { id: 'istanbul', title: 'Istanbul', subtitle: 'Turkiye', latitude: 41.0082, longitude: 28.9784, bounds: istanbulBounds },
    ]);

    renderScreen(<TimelineScreen getTimeline={getTimeline} />);

    await screen.findByText('Timeline Story 1');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.changeText(screen.getByLabelText('Location filter'), 'Istanbul');
    expect(await screen.findByText('Filtering by map area.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      expect(getTimeline).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          filters: expect.objectContaining({
            location: 'Istanbul',
            locationBounds: istanbulBounds,
          }),
        }),
      );
    });
  });

  it('shows empty and error states', async () => {
    const { rerender } = render(
      <SearchFiltersProvider>
        <TimelineScreen
          getTimeline={async () => makeTimelinePage({ items: [], totalCount: 0 })}
          showSearchControls={false}
        />
      </SearchFiltersProvider>,
    );

    expect(await screen.findByText('Timeline is empty')).toBeTruthy();

    rerender(
      <SearchFiltersProvider>
        <TimelineScreen
          getTimeline={async () => {
            throw new Error('Timeline backend failed.');
          }}
          showSearchControls={false}
        />
      </SearchFiltersProvider>,
    );

    expect(await screen.findByText('Timeline unavailable')).toBeTruthy();
    expect(screen.getByText('Timeline backend failed.')).toBeTruthy();
  });
});
