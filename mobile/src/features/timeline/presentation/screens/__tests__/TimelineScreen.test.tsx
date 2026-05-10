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
  searchTags: jest.fn(async () => []),
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

  function openFilters() {
    fireEvent.press(screen.getByText('Show filters'));
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
    expect(screen.getByText('Location 1')).toBeTruthy();
    expect(screen.queryByText('Choose a time window')).toBeNull();
    expect(screen.getAllByText('1950').length).toBeGreaterThan(0);
    fireEvent.press(screen.getByLabelText('Open timeline story: Timeline Story 1'));

    expect(onOpenStory).toHaveBeenCalledWith('1');
  });

  it('uses the story time period in the left timeline badge and hides card year chips', async () => {
    renderScreen(
      <TimelineScreen
        getTimeline={async () =>
          makeTimelinePage({
            items: [
              makeStory('decade', {
                timeType: 'decade',
                timePeriod: '1900s',
                temporalCoverage: '190X',
                historicalYear: 1905,
              }),
            ],
          })
        }
        showSearchControls={false}
      />,
    );

    expect(await screen.findByText('1900s')).toBeTruthy();
    expect(screen.queryByText('190X')).toBeNull();
    expect(screen.queryByText('1905')).toBeNull();
  });

  it('preserves exact date and range labels in the left timeline badge', async () => {
    renderScreen(
      <TimelineScreen
        getTimeline={async () =>
          makeTimelinePage({
            items: [
              makeStory('range', {
                timeType: 'year_range',
                timePeriod: '1914-1918',
                historicalYear: 1916,
              }),
              makeStory('date', {
                timeType: 'exact_date',
                timePeriod: '1923-10-29 09:30',
                historicalYear: 1923,
              }),
            ],
          })
        }
        showSearchControls={false}
      />,
    );

    expect(await screen.findByText('1914-1918')).toBeTruthy();
    expect(screen.getByText('1923-10-29 09:30')).toBeTruthy();
    expect(screen.queryByText('1910s')).toBeNull();
    expect(screen.queryByText('1920s')).toBeNull();
  });

  it('applies decade selection after Done is pressed', async () => {
    const getTimeline = jest.fn<Promise<TimelinePageEntity>, [any]>().mockResolvedValue(makeTimelinePage());

    renderScreen(<TimelineScreen getTimeline={getTimeline} />);

    await screen.findByText('Timeline Story 1');
    const callCountAfterInitialLoad = getTimeline.mock.calls.length;

    openFilters();
    fireEvent.press(screen.getByLabelText('Timeline mode Decade'));
    const callCountAfterModeSwitch = getTimeline.mock.calls.length;
    expect(callCountAfterModeSwitch).toBe(callCountAfterInitialLoad);

    fireEvent.changeText(screen.getByLabelText('Timeline decade'), '19');

    expect(getTimeline).toHaveBeenCalledTimes(callCountAfterModeSwitch);
    fireEvent(screen.getByLabelText('Timeline decade'), 'submitEditing');

    await waitFor(() => {
      expect(getTimeline).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          decade: 10,
        }),
      );
    });
    expect(screen.queryByText('Enter a valid decade base year.')).toBeNull();

    fireEvent.changeText(screen.getByLabelText('Timeline decade'), '1920');
    expect(getTimeline).toHaveBeenCalledTimes(callCountAfterModeSwitch + 1);
    fireEvent(screen.getByLabelText('Timeline decade'), 'submitEditing');

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

  it('accepts short and negative historical decade years', async () => {
    const getTimeline = jest.fn<Promise<TimelinePageEntity>, [any]>().mockResolvedValue(makeTimelinePage());

    renderScreen(<TimelineScreen getTimeline={getTimeline} />);

    await screen.findByText('Timeline Story 1');

    openFilters();
    fireEvent.press(screen.getByLabelText('Timeline mode Decade'));
    fireEvent.changeText(screen.getByLabelText('Timeline decade'), '445');
    fireEvent(screen.getByLabelText('Timeline decade'), 'submitEditing');

    await waitFor(() => {
      expect(getTimeline).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          decade: 440,
        }),
      );
    });

    fireEvent.changeText(screen.getByLabelText('Timeline decade'), '-7500');
    fireEvent(screen.getByLabelText('Timeline decade'), 'submitEditing');

    await waitFor(() => {
      expect(getTimeline).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          decade: -7500,
        }),
      );
    });
  });

  it('keeps period inputs mounted while a typed filter is loading', async () => {
    const getTimeline = jest
      .fn<Promise<TimelinePageEntity>, [any]>()
      .mockResolvedValueOnce(makeTimelinePage({ items: [], totalCount: 0 }))
      .mockImplementation(() => new Promise<TimelinePageEntity>(() => undefined));

    renderScreen(<TimelineScreen getTimeline={getTimeline} />);

    await screen.findByText('Timeline is empty');

    openFilters();
    fireEvent.press(screen.getByLabelText('Timeline mode Decade'));
    fireEvent.changeText(screen.getByLabelText('Timeline decade'), '1');

    expect(screen.queryByLabelText('Loading timeline stories')).toBeNull();
    expect(screen.getByLabelText('Timeline decade')).toBeTruthy();
  });

  it('keeps range typing local until both years are provided', async () => {
    const getTimeline = jest.fn<Promise<TimelinePageEntity>, [any]>().mockResolvedValue(makeTimelinePage());

    renderScreen(<TimelineScreen getTimeline={getTimeline} />);

    await screen.findByText('Timeline Story 1');
    const callCountAfterInitialLoad = getTimeline.mock.calls.length;

    openFilters();
    fireEvent.press(screen.getByLabelText('Timeline mode Range'));
    const callCountAfterRangeMode = getTimeline.mock.calls.length;
    expect(callCountAfterRangeMode).toBe(callCountAfterInitialLoad);

    fireEvent.changeText(screen.getByLabelText('Timeline start year'), '445');

    expect(getTimeline).toHaveBeenCalledTimes(callCountAfterRangeMode);

    fireEvent.changeText(screen.getByLabelText('Timeline end year'), '1110');

    expect(getTimeline).toHaveBeenCalledTimes(callCountAfterRangeMode);
    fireEvent(screen.getByLabelText('Timeline end year'), 'submitEditing');

    await waitFor(() => {
      expect(getTimeline).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          yearRange: { from: 445, to: 1110 },
        }),
      );
    });
  });

  it('clears the previous period mode when switching between controls', async () => {
    const getTimeline = jest.fn<Promise<TimelinePageEntity>, [any]>().mockResolvedValue(makeTimelinePage());

    renderScreen(<TimelineScreen getTimeline={getTimeline} />);

    await screen.findByText('Timeline Story 1');

    openFilters();
    fireEvent.press(screen.getByLabelText('Timeline mode Year'));
    fireEvent.changeText(screen.getByLabelText('Timeline year'), '100');
    fireEvent(screen.getByLabelText('Timeline year'), 'submitEditing');

    await waitFor(() => {
      expect(getTimeline).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          year: 100,
        }),
      );
    });

    fireEvent.press(screen.getByLabelText('Timeline mode Range'));

    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      const lastRequest = getTimeline.mock.calls[getTimeline.mock.calls.length - 1][0];

      expect(lastRequest).toEqual(expect.objectContaining({ page: 1 }));
      expect(lastRequest.year).toBeUndefined();
      expect(lastRequest.yearRange).toBeUndefined();
      expect(lastRequest.decade).toBeUndefined();
    });
    expect(screen.getByText('All time periods')).toBeTruthy();

    openFilters();
    expect(screen.queryByLabelText('Timeline year')).toBeNull();
    expect(screen.getByLabelText('Timeline start year').props.value).toBe('');
    expect(screen.getByLabelText('Timeline end year').props.value).toBe('');
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

  it('applies image availability filters from the timeline controls', async () => {
    const getTimeline = jest.fn<Promise<TimelinePageEntity>, [any]>().mockResolvedValue(makeTimelinePage());

    renderScreen(<TimelineScreen getTimeline={getTimeline} />);

    await screen.findByText('Timeline Story 1');
    openFilters();
    fireEvent.press(screen.getByLabelText('Filter stories with image'));
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      expect(getTimeline).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          filters: expect.objectContaining({
            hasMedia: true,
          }),
        }),
      );
    });

    openFilters();
    fireEvent.press(screen.getByLabelText('Filter stories with image'));
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      expect(getTimeline).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          filters: expect.objectContaining({
            hasMedia: undefined,
          }),
        }),
      );
    });

    expect(screen.queryByLabelText('Timeline image filter With image')).toBeNull();
    expect(screen.queryByLabelText('Timeline image filter All')).toBeNull();
    expect(screen.queryByLabelText('Timeline image filter Without image')).toBeNull();
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
