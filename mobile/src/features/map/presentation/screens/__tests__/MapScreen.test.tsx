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
  searchTags: jest.fn(async () => []),
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
      markers?: Array<{ id: string; selected?: boolean; visualRole?: 'timeline' | 'selected'; label?: string }>;
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
        <Pressable
          testID="map-region-wide"
          onPress={() =>
            onRegionChangeComplete?.({
              latitude: 41.02,
              longitude: 28.97,
              latitudeDelta: 1,
              longitudeDelta: 1,
            })
          }
        />
        {markers.map((marker) => (
          <Pressable
            key={marker.id}
            onPress={() => onMarkerPress?.(marker.id)}
            testID="story-marker"
            accessibilityLabel={`marker:${marker.id}:${marker.label ?? ''}`}
            accessibilityState={{ selected: Boolean(marker.selected) }}
            accessibilityValue={{ text: marker.visualRole ?? 'default' }}
          />
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

const zoomClusterMarkerGroups: MapMarkerGroup[] = [
  {
    id: 'near-1',
    latitude: 41,
    longitude: 29,
    count: 1,
    isCluster: false,
    stories: [
      {
        id: 'story-near-1',
        title: 'First Nearby Memory',
        placeName: 'Kadikoy',
        timePeriod: '1970s',
        previewText: 'A nearby story.',
        latitude: 41,
        longitude: 29,
      },
    ],
  },
  {
    id: 'near-2',
    latitude: 41.012,
    longitude: 29.012,
    count: 1,
    isCluster: false,
    stories: [
      {
        id: 'story-near-2',
        title: 'Second Nearby Memory',
        placeName: 'Moda',
        timePeriod: '1980s',
        previewText: 'Another nearby story.',
        latitude: 41.012,
        longitude: 29.012,
      },
    ],
  },
  {
    id: 'far-1',
    latitude: 41.7,
    longitude: 29.7,
    count: 1,
    isCluster: false,
    stories: [
      {
        id: 'story-far-1',
        title: 'Far Away Memory',
        placeName: 'Sile',
        timePeriod: '1990s',
        previewText: 'A distant story.',
        latitude: 41.7,
        longitude: 29.7,
      },
    ],
  },
];

const backendGroupedDistinctMarkerGroups: MapMarkerGroup[] = [
  {
    id: 'backend-group',
    latitude: 41.01,
    longitude: 28.97,
    count: 3,
    isCluster: true,
    stories: [
      {
        id: 'backend-story-1',
        title: 'Backend Group One',
        placeName: 'Beyazit',
        timePeriod: '1900s',
        previewText: 'First grouped story.',
        latitude: 41.01,
        longitude: 28.97,
      },
      {
        id: 'backend-story-2',
        title: 'Backend Group Two',
        placeName: 'Laleli',
        timePeriod: '1910s',
        previewText: 'Second grouped story.',
        latitude: 41.012,
        longitude: 28.972,
      },
      {
        id: 'backend-story-3',
        title: 'Backend Group Three',
        placeName: 'Vezneciler',
        timePeriod: '1920s',
        previewText: 'Third grouped story.',
        latitude: 41.014,
        longitude: 28.974,
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

  it('does not repeat active filters above the map', async () => {
    renderScreen(
      <MapScreen
        initialFilters={{
          q: 'hidden query',
          location: 'Hidden Place',
          yearFrom: 1900,
          yearTo: 1950,
          tags: ['History'],
        }}
        getMarkerGroups={async () => markerGroups}
        showSearchControls={false}
      />,
    );

    expect(await screen.findByTestId('story-map')).toBeTruthy();
    expect(screen.queryByText('Search: hidden query')).toBeNull();
    expect(screen.queryByText('Place: Hidden Place')).toBeNull();
    expect(screen.queryByText('Years: 1900-1950')).toBeNull();
    expect(screen.queryByText('History')).toBeNull();
  });

  it('clusters nearby pins while zoomed out and separates them after zooming in', async () => {
    renderScreen(<MapScreen getMarkerGroups={async () => zoomClusterMarkerGroups} />);

    await screen.findByText('Select a story marker to preview.');

    await waitFor(() => {
      expect(screen.getAllByTestId('story-marker')).toHaveLength(2);
    });
    expect(screen.getByLabelText(/^marker:zoom-cluster:.*:2$/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText(/^marker:zoom-cluster:.*:2$/));

    await waitFor(() => {
      const region = getRenderedMapRegion();

      expect(region.latitude).toBeCloseTo(41.006);
      expect(region.longitude).toBeCloseTo(29.006);
      expect(region.latitudeDelta).toBeLessThan(1);
      expect(region.longitudeDelta).toBeLessThan(1);
    });
    expect(screen.getByText('2 stories found in this area')).toBeTruthy();

    fireEvent.press(screen.getByTestId('map-region-change'));

    await waitFor(() => {
      expect(screen.getAllByTestId('story-marker')).toHaveLength(3);
    });
  });

  it('keeps zooming a selected cluster when stories have different coordinates', async () => {
    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await screen.findByText('Select a story marker to preview.');

    const clusterMarker = await screen.findByLabelText('marker:41.01:28.97:2');
    fireEvent.press(clusterMarker);

    await waitFor(() => {
      expect(screen.getByLabelText('marker:41.01:28.97:').props.accessibilityState.selected).toBe(true);
    });
    const firstZoomRegion = getRenderedMapRegion();

    fireEvent.press(await screen.findByLabelText('marker:41.01:28.97:'));

    await waitFor(() => {
      expect(getRenderedMapRegion().longitudeDelta).toBeLessThan(firstZoomRegion.longitudeDelta);
    });
  });

  it('splits a backend grouped marker into story pins as the user keeps zooming', async () => {
    renderScreen(<MapScreen getMarkerGroups={async () => backendGroupedDistinctMarkerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    expect(await screen.findByLabelText('marker:backend-group:3')).toBeTruthy();

    fireEvent.press(await screen.findByLabelText('marker:backend-group:3'));
    fireEvent.press(await screen.findByLabelText('marker:backend-group:'));

    await waitFor(() => {
      expect(screen.getAllByTestId('story-marker')).toHaveLength(3);
    });
    expect(screen.queryByLabelText('marker:backend-group:3')).toBeNull();
  });

  it('shows the selected marker preview and navigates to story detail', async () => {
    const onOpenStory = jest.fn();

    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} onOpenStory={onOpenStory} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getAllByTestId('story-marker')[0]);
    const selectedStoryTitle = await screen.findByText('The Day the Harbor Fell Silent');
    expect(selectedStoryTitle).toBeTruthy();
    expect(selectedStoryTitle.props.pointerEvents).toBe('none');
    fireEvent.press(screen.getByText('Read full story'));

    expect(onOpenStory).toHaveBeenCalledWith('story-001');
  });

  it('offers a timeline action for a selected marker', async () => {
    const onViewTimeline = jest.fn();

    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} onViewTimeline={onViewTimeline} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getAllByTestId('story-marker')[0]);
    fireEvent.press(await screen.findByLabelText('View timeline near The Day the Harbor Fell Silent'));

    expect(onViewTimeline).toHaveBeenCalledWith({
      latitude: 41.0284,
      longitude: 28.9647,
      label: 'The Day the Harbor Fell Silent',
      storyId: 'story-001',
    });
  });

  it('highlights the active map pin distance filter until the filter is removed', async () => {
    await storage.set(storageKeys.mapSearchFilters, {
      proximityRadiusKm: 0.5,
      proximityCoordinates: {
        latitude: 41.0284,
        longitude: 28.9647,
      },
      proximitySource: 'map_pin',
    });

    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await waitFor(() => {
      expect(screen.getByLabelText('marker:map-pin-story:story-001:').props.accessibilityState.selected).toBe(true);
    });

    fireEvent.press(screen.getByLabelText('Remove Distance: 500 m from red location pin'));

    await waitFor(() => {
      expect(screen.getAllByTestId('story-marker')[0].props.accessibilityState.selected).toBe(false);
    });
  });

  it('shows separate pins for the timeline filter and current selected story', async () => {
    await storage.set(storageKeys.mapSearchFilters, {
      proximityRadiusKm: 0.5,
      proximityCoordinates: {
        latitude: 41,
        longitude: 29,
      },
      proximitySource: 'map_pin',
      proximityLabel: 'First Nearby Memory',
      proximityStoryId: 'story-near-1',
    });

    renderScreen(<MapScreen getMarkerGroups={async () => zoomClusterMarkerGroups} />);

    await waitFor(() => {
      expect(screen.getByLabelText('marker:map-pin-story:story-near-1:').props.accessibilityValue.text).toBe('timeline');
    });

    fireEvent.press(screen.getByLabelText('marker:far-1:'));

    await waitFor(() => {
      expect(screen.getByLabelText('marker:far-1:').props.accessibilityValue.text).toBe('selected');
    });
    expect(screen.getByLabelText('marker:map-pin-story:story-near-1:').props.accessibilityValue.text).toBe('timeline');
  });

  it('hides the selected marker preview when the same marker is pressed again', async () => {
    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getByLabelText('marker:41.02:28.96:'));
    expect(await screen.findByText('The Day the Harbor Fell Silent')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('marker:41.02:28.96:'));

    await waitFor(() => {
      expect(screen.queryByText('The Day the Harbor Fell Silent')).toBeNull();
      expect(screen.getByText('Select a story marker to preview.')).toBeTruthy();
    });
  });

  it('keeps manual map panning available after a marker is selected', async () => {
    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getAllByTestId('story-marker')[0]);
    await screen.findByText('The Day the Harbor Fell Silent');

    fireEvent.press(screen.getByTestId('map-region-empty'));

    await waitFor(() => {
      const manualRegion = getRenderedMapRegion();

      expect(manualRegion.latitude).toBeCloseTo(40.5);
      expect(manualRegion.longitude).toBeCloseTo(29.8);
      expect(manualRegion.latitudeDelta).toBeCloseTo(0.02);
      expect(manualRegion.longitudeDelta).toBeCloseTo(0.02);
    });
  });

  it('keeps a selected red story pin fixed when zooming out into nearby stories', async () => {
    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getByLabelText('marker:41.02:28.96:'));

    await waitFor(() => {
      expect(screen.getByLabelText('marker:41.02:28.96:').props.accessibilityState.selected).toBe(true);
    });

    fireEvent.press(screen.getByTestId('map-region-wide'));

    await waitFor(() => {
      expect(screen.getByLabelText('marker:41.02:28.96:').props.accessibilityState.selected).toBe(true);
    });
    expect(screen.getByLabelText('marker:41.01:28.97:2')).toBeTruthy();
    expect(screen.queryByLabelText(/^marker:zoom-cluster:.*:3$/)).toBeNull();
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

  it('does not offer a group timeline action for a selected grouped marker', async () => {
    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getByLabelText('marker:41.01:28.97:2'));

    await waitFor(() => {
      expect(screen.getByText('2 nearby stories')).toBeTruthy();
    });
    expect(screen.queryByLabelText('View timeline near 2 nearby stories')).toBeNull();
    expect(screen.getByLabelText('marker:41.01:28.97:').props.accessibilityState.selected).toBe(true);
    expect(screen.queryByLabelText('marker:41.01:28.97:2')).toBeNull();
  });

  it('offers story-specific timeline actions inside a clustered marker', async () => {
    const onViewTimeline = jest.fn();

    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} onViewTimeline={onViewTimeline} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getAllByTestId('story-marker')[1]);
    fireEvent.press(await screen.findByLabelText('View timeline near Lanterns Above the Hill Market'));

    expect(onViewTimeline).toHaveBeenCalledWith({
      latitude: 41.0249,
      longitude: 28.9548,
      label: 'Lanterns Above the Hill Market',
      storyId: 'story-002',
    });
  });

  it('shows a red story pin apart from cluster pins when zoomed out', async () => {
    await storage.set(storageKeys.mapSearchFilters, {
      proximityRadiusKm: 0.5,
      proximityCoordinates: {
        latitude: 41.01,
        longitude: 28.97,
      },
      proximitySource: 'map_pin',
      proximityLabel: 'Backend Group One',
      proximityStoryId: 'backend-story-1',
    });

    renderScreen(<MapScreen getMarkerGroups={async () => backendGroupedDistinctMarkerGroups} />);

    await waitFor(() => {
      expect(screen.getByLabelText('marker:map-pin-story:backend-story-1:').props.accessibilityState.selected).toBe(true);
    });
    expect(screen.getByLabelText('marker:backend-group:without:backend-story-1:2')).toBeTruthy();
  });

  it('keeps the red story pin out of grouping after zoom changes', async () => {
    await storage.set(storageKeys.mapSearchFilters, {
      proximityRadiusKm: 0.5,
      proximityCoordinates: {
        latitude: 41.01,
        longitude: 28.97,
      },
      proximitySource: 'map_pin',
      proximityLabel: 'Backend Group One',
      proximityStoryId: 'backend-story-1',
    });

    renderScreen(<MapScreen getMarkerGroups={async () => backendGroupedDistinctMarkerGroups} />);

    await waitFor(() => {
      expect(screen.getByLabelText('marker:map-pin-story:backend-story-1:').props.accessibilityState.selected).toBe(true);
    });
    expect(screen.getByLabelText('marker:backend-group:without:backend-story-1:2')).toBeTruthy();

    fireEvent.press(screen.getByTestId('map-region-empty'));

    await waitFor(() => {
      expect(screen.getByLabelText('marker:map-pin-story:backend-story-1:').props.accessibilityState.selected).toBe(true);
    });
    expect(screen.getByLabelText('marker:backend-group:without:backend-story-1:2')).toBeTruthy();

    fireEvent.press(screen.getByTestId('map-region-change'));

    await waitFor(() => {
      expect(screen.getByLabelText('marker:map-pin-story:backend-story-1:').props.accessibilityState.selected).toBe(true);
    });
    expect(screen.getByLabelText('marker:backend-group:without:backend-story-1:2')).toBeTruthy();
  });

  it('falls back to the story title when highlighting a map-pin timeline filter', async () => {
    await storage.set(storageKeys.mapSearchFilters, {
      proximityRadiusKm: 0.5,
      proximityCoordinates: {
        latitude: 41.0249,
        longitude: 28.9548,
      },
      proximitySource: 'map_pin',
      proximityLabel: 'Lanterns Above the Hill Market',
    });

    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await waitFor(() => {
      expect(screen.getByLabelText('marker:map-pin-story:story-002:').props.accessibilityState.selected).toBe(true);
    });
  });

  it('switches the red marker to the story selected from a clustered marker timeline action', async () => {
    const onViewTimeline = jest.fn();

    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} onViewTimeline={onViewTimeline} />);

    await screen.findByText('Select a story marker to preview.');
    fireEvent.press(screen.getAllByTestId('story-marker')[1]);
    fireEvent.press(await screen.findByLabelText('View timeline near Voices of the Ferry Pier'));

    expect(onViewTimeline).toHaveBeenCalledWith({
      latitude: 41.016,
      longitude: 28.98,
      label: 'Voices of the Ferry Pier',
      storyId: 'story-003',
    });
  });

  it('does not highlight a client-side group timeline coordinate after group timelines are removed', async () => {
    await storage.set(storageKeys.mapSearchFilters, {
      proximityRadiusKm: 0.5,
      proximityCoordinates: {
        latitude: 41.01613333333333,
        longitude: 28.968233333333335,
      },
      proximitySource: 'map_pin',
      proximityLabel: '2 nearby stories',
    });

    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    expect(screen.queryByLabelText(/^marker:zoom-cluster:.*:$/)).toBeNull();
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

    await waitFor(() => {
      expect(onMarkerPreviewRequested).toHaveBeenCalledWith(660);
    });
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

  it('does not show the blue current-location marker for map-pin proximity filters', async () => {
    await storage.set(storageKeys.mapSearchFilters, {
      query: '',
      location: '',
      proximityRadiusKm: 0.5,
      proximityCoordinates: {
        latitude: 41.0284,
        longitude: 28.9647,
      },
      proximitySource: 'map_pin',
      timeFrom: '',
      timeTo: '',
    });

    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await screen.findByText('Select a story marker to preview.');

    await waitFor(() => {
      expect(screen.queryByTestId('user-location-marker')).toBeNull();
    });
  });

  it('does not auto-zoom the map when a map-pin timeline filter is active', async () => {
    await storage.set(storageKeys.mapSearchFilters, {
      query: '',
      location: '',
      proximityRadiusKm: 0.5,
      proximityCoordinates: {
        latitude: 41.0284,
        longitude: 28.9647,
      },
      proximitySource: 'map_pin',
      proximityLabel: 'The Day the Harbor Fell Silent',
      timeFrom: '',
      timeTo: '',
    });

    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await screen.findByText('Select a story marker to preview.');
    const region = getRenderedMapRegion();

    expect(region.latitude).toBeCloseTo(41.0082);
    expect(region.longitude).toBeCloseTo(28.9784);
    expect(region.latitudeDelta).toBeCloseTo(0.32);
    expect(region.longitudeDelta).toBeCloseTo(0.48);
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
