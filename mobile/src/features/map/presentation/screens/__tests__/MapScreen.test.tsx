import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MapScreen } from '../MapScreen';
import { MapMarkerGroup } from '../../../domain/entities';
import { SearchFiltersProvider } from '../../../../search/presentation/context/SearchFiltersContext';
import { storage } from '../../../../../core/storage/storage';

jest.mock('../../../../../shared/components/WebMapView', () => {
  const React = require('react');
  const { View, Pressable } = require('react-native');

  return {
    WebMapView: ({
      markers = [],
      onMarkerPress,
    }: {
      markers?: Array<{ id: string }>;
      onMarkerPress?: (markerId: string) => void;
    }) => (
      <View testID="story-map" accessibilityLabel="Interactive story map">
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

describe('MapScreen', () => {
  beforeEach(async () => {
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
  });

  it('shows the selected marker preview and navigates to story detail', async () => {
    const onOpenStory = jest.fn();

    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} onOpenStory={onOpenStory} />);

    expect(await screen.findByText('The Day the Harbor Fell Silent')).toBeTruthy();
    fireEvent.press(screen.getByText('Read full story'));

    expect(onOpenStory).toHaveBeenCalledWith('story-001');
  });

  it('shows nearby stories when a clustered marker is pressed', async () => {
    renderScreen(<MapScreen getMarkerGroups={async () => markerGroups} />);

    await screen.findByText('The Day the Harbor Fell Silent');
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

    await screen.findByText('The Day the Harbor Fell Silent');
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

    await screen.findByText('The Day the Harbor Fell Silent');
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

  it('refetches all markers when a chip filter is removed', async () => {
    const getMarkerGroups = jest.fn<Promise<MapMarkerGroup[]>, [any]>().mockResolvedValue(markerGroups);

    renderScreen(<MapScreen getMarkerGroups={getMarkerGroups} />);

    await screen.findByText('The Day the Harbor Fell Silent');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.changeText(screen.getByLabelText('Location filter'), 'Golden Horn');

    await waitFor(() => {
      expect(getMarkerGroups).toHaveBeenLastCalledWith({
        q: undefined,
        location: 'Golden Horn',
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

    renderScreen(<MapScreen getMarkerGroups={getMarkerGroups} />);

    await screen.findByText('The Day the Harbor Fell Silent');
    fireEvent.press(screen.getByText('Show filters'));
    fireEvent.changeText(screen.getByLabelText('Location filter'), 'Golden Horn');

    await waitFor(() => {
      expect(getMarkerGroups).toHaveBeenLastCalledWith({
        q: undefined,
        location: 'Golden Horn',
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
