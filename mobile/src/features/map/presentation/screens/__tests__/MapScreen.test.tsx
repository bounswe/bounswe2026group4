import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MapScreen } from '../MapScreen';
import { MapMarkerGroup } from '../../../domain/entities';
import { SearchFiltersProvider } from '../../../../search/presentation/context/SearchFiltersContext';
import { storageKeys } from '../../../../../core/storage/keys';
import { storage } from '../../../../../core/storage/storage';
import { geocodeLocationQuery, searchLocationSuggestions } from '../../../../search/application/services';

jest.mock('../../../../search/application/services', () => ({
  geocodeLocationQuery: jest.fn(),
  searchLocationSuggestions: jest.fn(),
}));

const goldenHornBounds = { latMin: 41, latMax: 41.05, lngMin: 28.94, lngMax: 28.99 };

jest.mock('../../../../../shared/components/WebMapView', () => {
  const React = require('react');
  const { View, Pressable } = require('react-native');

  return {
    WebMapView: ({
      region,
      markers = [],
      userLocation,
      onMarkerPress,
      onRegionChangeComplete,
    }: {
      region?: {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
      };
      markers?: Array<{ id: string }>;
      userLocation?: {
        latitude: number;
        longitude: number;
      };
      onMarkerPress?: (markerId: string) => void;
      onRegionChangeComplete?: (region: {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
      }) => void;
    }) => (
      <View testID="story-map" accessibilityLabel="Interactive story map">
        <View
          testID="map-region-props"
          accessibilityLabel={`region:${region?.latitude}:${region?.longitude}:${region?.latitudeDelta}:${region?.longitudeDelta}`}
        />
        {userLocation ? (
          <View
            testID="user-location-marker"
            accessibilityLabel={`user-location:${userLocation.latitude}:${userLocation.longitude}`}
          />
        ) : null}
        <Pressable
          testID="map-region-change"
          onPress={() =>
            onRegionChangeComplete?.({
              latitude: 41.0284,
              longitude: 28.9647,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            })
          }
        />
        <Pressable
          testID="map-region-empty"
          onPress={() =>
            onRegionChangeComplete?.({
              latitude: 40.5,
              longitude: 29.8,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            })
          }
        />
        {markers.map((marker) => (
          <Pressable key={marker.id} onPress={() => onMarkerPress?.(marker.id)} testID="story-marker" />
        ))}
      </View>
    ),
  };
});

const markerGroups: MapMarkerGroup[] = [
  {
    id: '41.02:28.96',
    latitude: 41.0284,
    longitude: 28.9647,
    count: 1,
    isCluster: false,
    stories: [
      {
        id: 'story-001',
        title: 'The Day the Harbor Fell Silent',
        placeName: 'Golden Horn Docklands',
        timePeriod: 'Late 1970s',
        previewText: 'By dusk, the harbor had stopped sounding like work and started sounding like memory.',
        latitude: 41.0284,
        longitude: 28.9647,
      },
    ],
  },
  {
    id: '41.01:28.97',
    latitude: 41.01,
    longitude: 28.97,
    count: 2,
    isCluster: true,
    stories: [
      {
        id: 'story-002',
        title: 'Lanterns Above the Hill Market',
        placeName: 'Cibali Hill Market',
        timePeriod: '1950s to 1980s',
        previewText: 'Every winter festival, residents climbed the hill before sunset.',
        latitude: 41.0249,
        longitude: 28.9548,
      },
      {
        id: 'story-003',
        title: 'Voices of the Ferry Pier',
        placeName: 'Eminonu Pier',
        timePeriod: '1930s',
        previewText: 'Conductors called departures through a wall of steam.',
        latitude: 41.016,
        longitude: 28.98,
      },
    ],
  },
];

const refreshedMarkerGroups: MapMarkerGroup[] = [
  {
    id: '41.32:29.02',
    latitude: 41.32,
    longitude: 29.02,
    count: 1,
    isCluster: false,
    stories: [
      {
        id: 'story-004',
        title: 'A Different Hilltop',
        placeName: 'Uskudar Ridge',
        timePeriod: '1970s',
        previewText: 'Families watched the city lights arrive one by one.',
        latitude: 41.32,
        longitude: 29.02,
      },
    ],
  },
];

function getRenderedMapRegion() {
  const label = screen.getByTestId('map-region-props').props.accessibilityLabel as string;
  const [, latitude, longitude, latitudeDelta, longitudeDelta] = label.split(':');

  return {
    latitude: Number(latitude),
    longitude: Number(longitude),
    latitudeDelta: Number(latitudeDelta),
    longitudeDelta: Number(longitudeDelta),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe('MapScreen', () => {
  beforeEach(async () => {
    (geocodeLocationQuery as jest.Mock).mockResolvedValue(null);
    (searchLocationSuggestions as jest.Mock).mockResolvedValue([]);
    await storage.clear();
  });

  function renderScreen(ui: React.ReactElement) {
    return render(<SearchFiltersProvider>{ui}</SearchFiltersProvider>);
  }

  it('renders the map and fetched markers', async () => {
    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    expect(screen.getByLabelText('Loading map pins')).toBeTruthy();
    expect(await screen.findByTestId('story-map')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByTestId('story-marker')).toHaveLength(2);
    });
    await waitFor(() => {
      expect(screen.getByTestId('map-region-props').props.accessibilityLabel).toContain('region:41.0192:28.96735:0.06:0.06');
    });
    expect(screen.getByText('Select a story marker to preview.')).toBeTruthy();
  });

  it('shows the selected marker preview and navigates to story detail', async () => {
    const onOpenStory = jest.fn();

    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} onOpenStory={onOpenStory} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getAllByTestId('story-marker')[0]);
    expect(await screen.findByText('The Day the Harbor Fell Silent')).toBeTruthy();
    fireEvent.press(screen.getByText('Read full story'));

    expect(onOpenStory).toHaveBeenCalledWith('story-001');
  });

  it('shows nearby stories when a clustered marker is pressed', async () => {
    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getAllByTestId('story-marker')[1]);

    await waitFor(() => {
      expect(screen.getByText('2 nearby stories')).toBeTruthy();
    });
    expect(screen.getByText('Lanterns Above the Hill Market')).toBeTruthy();
    expect(screen.getByText('Voices of the Ferry Pier')).toBeTruthy();
  });

  it('requests scrolling to the preview when a marker is pressed', async () => {
    const onMarkerPreviewRequested = jest.fn();

    renderScreen(
      <MapScreen
        getMarkerGroups={async () => markerGroups}
        onMarkerPreviewRequested={onMarkerPreviewRequested}
      />,
    );

    await screen.findByText('Select a story marker to preview.');
    fireEvent(screen.getByTestId('map-card-container'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 240, width: 100, height: 100 } },
    });
    fireEvent(screen.getByTestId('story-preview-panel'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 420, width: 100, height: 100 } },
    });
    fireEvent.press(screen.getAllByTestId('story-marker')[1]);

    expect(onMarkerPreviewRequested).toHaveBeenCalledWith(660);
  });

  it('refetches markers when filters change', async () => {
    const getMarkerGroups = jest.fn<Promise<MapMarkerGroup[]>, [any]>().mockResolvedValue(markerGroups);

    renderScreen(<MapScreen getMarkerGroups={getMarkerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.changeText(screen.getByLabelText('Search stories'), 'harbor');

    await waitFor(() => {
      expect(getMarkerGroups).toHaveBeenLastCalledWith({
        q: 'harbor',
        location: undefined,
        yearFrom: undefined,
        yearTo: undefined,
      });
    });
  });

  it('shows a floating status badge after a search returns results', async () => {
    renderScreen(
      <MapScreen
        getMarkerGroups={async (filters) =>
          filters?.q === 'harbor' ? [markerGroups[0]] : markerGroups
        }
      />,
    );

    await screen.findByText('Select a story marker to preview.');
    fireEvent.changeText(screen.getByLabelText('Search stories'), 'harbor');

    expect(await screen.findByText('1 story found in this area')).toBeTruthy();
    expect(screen.getByTestId('map-search-status-badge')).toBeTruthy();
  });

  it('fits the map to all matched stories after a search', async () => {
    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.changeText(screen.getByLabelText('Search stories'), 'market');

    await waitFor(() => {
      expect(screen.getByTestId('map-region-props').props.accessibilityLabel).toContain('region:41.0192:28.96735:');
      expect(screen.getByTestId('map-region-props').props.accessibilityLabel).toContain(':0.06');
    });
  });

  it('zooms to selected location bounds when a location filter returns stories', async () => {
    (geocodeLocationQuery as jest.Mock).mockResolvedValueOnce(goldenHornBounds);

    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.changeText(screen.getByLabelText('Location filter'), 'Golden Horn');
    expect(await screen.findByText('Filtering by map area.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      const region = getRenderedMapRegion();

      expect(region.latitude).toBeCloseTo(41.025);
      expect(region.longitude).toBeCloseTo(28.965);
      expect(region.latitudeDelta).toBeCloseTo(0.0575);
      expect(region.longitudeDelta).toBeCloseTo(0.0575);
    });
  });

  it('zooms to selected location bounds when a location filter has no stories', async () => {
    const getMarkerGroups = jest.fn<Promise<MapMarkerGroup[]>, [any]>().mockImplementation(async (filters) =>
      filters?.location ? [] : markerGroups,
    );
    (geocodeLocationQuery as jest.Mock).mockResolvedValueOnce(goldenHornBounds);

    renderScreen(<MapScreen getMarkerGroups={getMarkerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    await waitFor(() => {
      const initialRegion = getRenderedMapRegion();

      expect(initialRegion.latitude).toBeCloseTo(41.0192);
      expect(initialRegion.longitude).toBeCloseTo(28.96735);
    });

    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.changeText(screen.getByLabelText('Location filter'), 'Golden Horn');
    expect(await screen.findByText('Filtering by map area.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Apply filters'));

    expect(await screen.findByText('No stories found in Golden Horn')).toBeTruthy();
    const region = getRenderedMapRegion();

    expect(region.latitude).toBeCloseTo(41.025);
    expect(region.longitude).toBeCloseTo(28.965);
    expect(region.latitudeDelta).toBeCloseTo(0.0575);
    expect(region.longitudeDelta).toBeCloseTo(0.0575);
  });

  it('re-zooms to the selected location when the same location filter is applied again', async () => {
    const getMarkerGroups = jest.fn<Promise<MapMarkerGroup[]>, [any]>().mockResolvedValue(markerGroups);
    (geocodeLocationQuery as jest.Mock).mockResolvedValue(goldenHornBounds);

    renderScreen(<MapScreen getMarkerGroups={getMarkerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.changeText(screen.getByLabelText('Location filter'), 'Golden Horn');
    expect(await screen.findByText('Filtering by map area.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      const region = getRenderedMapRegion();

      expect(region.latitude).toBeCloseTo(41.025);
      expect(region.longitude).toBeCloseTo(28.965);
    });

    fireEvent.press(screen.getByTestId('map-region-empty'));
    await waitFor(() => {
      const manualRegion = getRenderedMapRegion();

      expect(manualRegion.latitude).toBeCloseTo(40.5);
      expect(manualRegion.longitude).toBeCloseTo(29.8);
    });

    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      const region = getRenderedMapRegion();

      expect(region.latitude).toBeCloseTo(41.025);
      expect(region.longitude).toBeCloseTo(28.965);
    });
  });

  it('keeps a manually adjusted map view when markers refresh in the same context', async () => {
    const getMarkerGroups = jest
      .fn<Promise<MapMarkerGroup[]>, [any]>()
      .mockResolvedValueOnce(markerGroups)
      .mockResolvedValueOnce(refreshedMarkerGroups);
    let refreshHandler: (() => Promise<void>) | null = null;

    renderScreen(
      <MapScreen
        getMarkerGroups={getMarkerGroups}
        onRegisterRefresh={(handler) => {
          refreshHandler = handler;
        }}
      />,
    );

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getByTestId('map-region-empty'));
    await waitFor(() => {
      const manualRegion = getRenderedMapRegion();

      expect(manualRegion.latitude).toBeCloseTo(40.5);
      expect(manualRegion.longitude).toBeCloseTo(29.8);
      expect(manualRegion.latitudeDelta).toBeCloseTo(0.02);
      expect(manualRegion.longitudeDelta).toBeCloseTo(0.02);
    });

    await act(async () => {
      await refreshHandler?.();
    });

    await waitFor(() => {
      expect(getMarkerGroups).toHaveBeenCalledTimes(2);
    });
    const refreshedRegion = getRenderedMapRegion();

    expect(refreshedRegion.latitude).toBeCloseTo(40.5);
    expect(refreshedRegion.longitude).toBeCloseTo(29.8);
    expect(refreshedRegion.latitudeDelta).toBeCloseTo(0.02);
    expect(refreshedRegion.longitudeDelta).toBeCloseTo(0.02);
  });

  it('ignores stale marker responses after a newer filter request completes', async () => {
    const initialMarkers = createDeferred<MapMarkerGroup[]>();
    const filteredMarkers = createDeferred<MapMarkerGroup[]>();
    const getMarkerGroups = jest.fn<Promise<MapMarkerGroup[]>, [any]>().mockImplementation(async (filters) => {
      if (filters?.q === 'ridge') {
        return filteredMarkers.promise;
      }

      return initialMarkers.promise;
    });

    renderScreen(<MapScreen getMarkerGroups={getMarkerGroups} />);

    await waitFor(() => {
      expect(getMarkerGroups).toHaveBeenCalled();
    });
    fireEvent.changeText(screen.getByLabelText('Search stories'), 'ridge');
    await screen.findByLabelText('Clear search');
    fireEvent.press(screen.getByLabelText('Apply search'));

    await waitFor(() => {
      expect(getMarkerGroups.mock.calls.some(([filters]) => filters?.q === 'ridge')).toBe(true);
    });

    await act(async () => {
      filteredMarkers.resolve(refreshedMarkerGroups);
    });

    await waitFor(() => {
      const region = getRenderedMapRegion();

      expect(region.latitude).toBeCloseTo(41.32);
      expect(region.longitude).toBeCloseTo(29.02);
    });

    await act(async () => {
      initialMarkers.resolve(markerGroups);
    });

    await waitFor(() => {
      expect(getMarkerGroups.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
    const region = getRenderedMapRegion();

    expect(region.latitude).toBeCloseTo(41.32);
    expect(region.longitude).toBeCloseTo(29.02);
  });

  it('keeps unapplied location filters disabled when the place cannot be found', async () => {
    const getMarkerGroups = jest.fn<Promise<MapMarkerGroup[]>, [any]>().mockResolvedValue([]);

    renderScreen(<MapScreen getMarkerGroups={getMarkerGroups} />);

    await screen.findByText('No stories match the current filters.');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.changeText(screen.getByLabelText('Location filter'), 'Beykoz');
    expect(await screen.findByText('Location not found. Choose a listed place before applying.')).toBeTruthy();
    expect(screen.getByLabelText('Apply filters').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      expect(getMarkerGroups).toHaveBeenLastCalledWith({});
    });
  });

  it('does not apply placeholder year filters when submitted unchanged', async () => {
    const getMarkerGroups = jest.fn<Promise<MapMarkerGroup[]>, [any]>().mockResolvedValue(markerGroups);

    renderScreen(<MapScreen getMarkerGroups={getMarkerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      expect(getMarkerGroups).toHaveBeenLastCalledWith({
        q: undefined,
        location: undefined,
        yearFrom: undefined,
        yearTo: undefined,
      });
    });
  });

  it('hides the badge when the active search is cleared', async () => {
    renderScreen(
      <MapScreen
        getMarkerGroups={async (filters) =>
          filters?.q === 'harbor' ? [markerGroups[0]] : markerGroups
        }
      />,
    );

    await screen.findByText('Select a story marker to preview.');
    fireEvent.changeText(screen.getByLabelText('Search stories'), 'harbor');
    expect(await screen.findByText('1 story found in this area')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Search stories'), '');

    await waitFor(() => {
      expect(screen.queryByTestId('map-search-status-badge')).toBeNull();
    });
  });

  it('updates the badge when the visible map area changes', async () => {
    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getByTestId('map-region-empty'));

    expect(await screen.findByText('No stories found in this area')).toBeTruthy();

    fireEvent.press(screen.getByTestId('map-region-change'));

    expect(await screen.findByText('1 story found in this area')).toBeTruthy();
  });

  it('shows the user location marker when proximity filters are active', async () => {
    await storage.set(storageKeys.mapSearchFilters, {
      query: '',
      location: '',
      proximityRadiusKm: 10,
      proximityCoordinates: {
        latitude: 41.0082,
        longitude: 28.9784,
      },
      timeFrom: '',
      timeTo: '',
    });

    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await screen.findByText('Select a story marker to preview.');

    await waitFor(() => {
      expect(screen.getByTestId('user-location-marker').props.accessibilityLabel).toBe('user-location:41.0082:28.9784');
    });
  });

  it('hides the user location marker when proximity filter is anywhere even if old coordinates remain', async () => {
    await storage.set(storageKeys.mapSearchFilters, {
      query: '',
      location: '',
      proximityRadiusKm: undefined,
      proximityCoordinates: {
        latitude: 41.0082,
        longitude: 28.9784,
      },
      timeFrom: '',
      timeTo: '',
    });

    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await screen.findByText('Select a story marker to preview.');

    await waitFor(() => {
      expect(screen.queryByTestId('user-location-marker')).toBeNull();
    });
  });

  it('refetches all markers when a chip filter is removed', async () => {
    const getMarkerGroups = jest.fn<Promise<MapMarkerGroup[]>, [any]>().mockResolvedValue(markerGroups);
    (geocodeLocationQuery as jest.Mock).mockResolvedValueOnce(goldenHornBounds);

    renderScreen(<MapScreen getMarkerGroups={getMarkerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.changeText(screen.getByLabelText('Location filter'), 'Golden Horn');
    expect(await screen.findByText('Filtering by map area.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      expect(getMarkerGroups).toHaveBeenLastCalledWith({
        q: undefined,
        location: 'Golden Horn',
        locationBounds: goldenHornBounds,
        yearFrom: undefined,
        yearTo: undefined,
      });
    });

    fireEvent.press(screen.getByLabelText('Remove Location: Golden Horn'));

    await waitFor(() => {
      expect(getMarkerGroups).toHaveBeenLastCalledWith({
        q: undefined,
        location: undefined,
        yearFrom: undefined,
        yearTo: undefined,
      });
    });
  });

  it('refetches all markers when clear all filters is pressed', async () => {
    const getMarkerGroups = jest.fn<Promise<MapMarkerGroup[]>, [any]>().mockResolvedValue(markerGroups);
    (geocodeLocationQuery as jest.Mock).mockResolvedValueOnce(goldenHornBounds);

    renderScreen(<MapScreen getMarkerGroups={getMarkerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.changeText(screen.getByLabelText('Location filter'), 'Golden Horn');
    expect(await screen.findByText('Filtering by map area.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Apply filters'));

    await waitFor(() => {
      expect(getMarkerGroups).toHaveBeenLastCalledWith({
        q: undefined,
        location: 'Golden Horn',
        locationBounds: goldenHornBounds,
        yearFrom: undefined,
        yearTo: undefined,
      });
    });

    fireEvent.press(screen.getByText('Clear all filters'));

    await waitFor(() => {
      expect(getMarkerGroups).toHaveBeenLastCalledWith({
        q: undefined,
        location: undefined,
        yearFrom: undefined,
        yearTo: undefined,
      });
    });
  });

  it('keeps the map visible and shows an error overlay when loading fails', async () => {
    renderScreen(<MapScreen getMarkerGroups={async () => Promise.reject(new Error('API unavailable'))} />);

    expect(await screen.findByTestId('story-map')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('Unable to load stories')).toBeTruthy();
      expect(screen.getByText('API unavailable')).toBeTruthy();
    });
  });
});
