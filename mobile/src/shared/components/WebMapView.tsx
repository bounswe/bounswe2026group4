import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

type MarkerItem = {
  id: string;
  latitude: number;
  longitude: number;
  selected?: boolean;
  label?: string;
};

interface UserLocationLike {
  latitude: number;
  longitude: number;
}

interface RegionLike {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface WebMapViewProps {
  region: RegionLike;
  markers?: MarkerItem[];
  userLocation?: UserLocationLike;
  interactive?: boolean;
  onMarkerPress?: (markerId: string) => void;
  onMapPress?: (coords: { latitude: number; longitude: number }) => void;
  onRegionChangeComplete?: (region: RegionLike) => void;
  transitionDurationMs?: number;
}

type WebViewHandle = {
  injectJavaScript: (script: string) => void;
};

type MapUpdatePayload = {
  region: RegionLike;
  markers: MarkerItem[];
  userLocation: UserLocationLike | null;
  animated: boolean;
  transitionDurationMs: number;
};

const mapHtml = ({
  region,
  markers,
  userLocation,
  interactive,
  transitionDurationMs,
}: {
  region: RegionLike;
  markers: MarkerItem[];
  userLocation?: UserLocationLike;
  interactive: boolean;
  transitionDurationMs: number;
}) => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"
    />
    <style>
      html, body, #map {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #f3f4f6;
        touch-action: none;
      }

      .marker {
        width: 18px;
        height: 18px;
        border-radius: 9999px;
        background: #404040;
        border: 3px solid #ffffff;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
      }

      .marker.selected {
        background: #0a0a0a;
      }

      .marker-label {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        min-width: 14px;
        max-width: 18px;
        color: #ffffff;
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
        text-align: center;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
        pointer-events: none;
      }

      .user-location-marker {
        width: 18px;
        height: 18px;
        border-radius: 9999px;
        background: #1d4ed8;
        border: 3px solid #ffffff;
        box-shadow: 0 0 0 6px rgba(29, 78, 216, 0.18);
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
    <script>
      const region = ${JSON.stringify(region)};
      let markerData = ${JSON.stringify(markers)};
      let userLocationData = ${JSON.stringify(userLocation ?? null)};
      const interactive = ${interactive ? 'true' : 'false'};
      const defaultTransitionDurationMs = ${transitionDurationMs};
      let hasCompletedInitialMove = false;
      let isProgrammaticMove = false;
      let programmaticMoveTimer;
      let markerInstances = [];
      let userLocationMarker = null;

      const getZoomForRegion = (nextRegion) => {
        const requestedDelta = Math.max(
          Math.abs(nextRegion.latitudeDelta || 0),
          Math.abs(nextRegion.longitudeDelta || 0),
          0.0001
        );

        return Math.max(
          2,
          Math.min(16, Math.floor(Math.log2(360 / requestedDelta)))
        );
      };

      const map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [region.longitude, region.latitude],
        zoom: getZoomForRegion(region),
        attributionControl: false,
        dragPan: interactive,
        scrollZoom: interactive,
        doubleClickZoom: interactive,
        touchZoomRotate: interactive,
        dragRotate: false,
        pitchWithRotate: false,
        keyboard: false,
      });

      const postCurrentRegion = () => {
        const bounds = map.getBounds();
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();

        window.ReactNativeWebView?.postMessage(
          JSON.stringify({
            type: 'regionChange',
            latitude: map.getCenter().lat,
            longitude: map.getCenter().lng,
            latitudeDelta: Math.max(Math.abs(northEast.lat - southWest.lat), 0.0001),
            longitudeDelta: Math.max(Math.abs(northEast.lng - southWest.lng), 0.0001),
          })
        );
      };

      const clearProgrammaticMove = () => {
        if (programmaticMoveTimer) {
          window.clearTimeout(programmaticMoveTimer);
        }

        isProgrammaticMove = false;
      };

      const markProgrammaticMove = (duration) => {
        isProgrammaticMove = true;

        if (programmaticMoveTimer) {
          window.clearTimeout(programmaticMoveTimer);
        }

        programmaticMoveTimer = window.setTimeout(() => {
          isProgrammaticMove = false;
        }, Math.max(duration, 0) + 120);
      };

      const createStoryMarker = (marker) => {
        const element = document.createElement('div');
        element.className = marker.selected ? 'marker selected' : 'marker';

        if (marker.label) {
          const label = document.createElement('span');
          label.className = 'marker-label';
          label.textContent = marker.label;
          element.appendChild(label);
        }

        element.addEventListener('click', (event) => {
          event.stopPropagation();
          window.ReactNativeWebView?.postMessage(
            JSON.stringify({ type: 'markerPress', markerId: marker.id })
          );
        });

        return new maplibregl.Marker({ element, anchor: 'center' })
          .setLngLat([marker.longitude, marker.latitude])
          .addTo(map);
      };

      const renderMarkers = (nextMarkers, nextUserLocation) => {
        markerInstances.forEach((marker) => marker.remove());
        markerInstances = [];

        nextMarkers.forEach((marker) => {
          markerInstances.push(createStoryMarker(marker));
        });

        if (userLocationMarker) {
          userLocationMarker.remove();
          userLocationMarker = null;
        }

        if (nextUserLocation) {
          const element = document.createElement('div');
          element.className = 'user-location-marker';

          userLocationMarker = new maplibregl.Marker({ element, anchor: 'center' })
            .setLngLat([nextUserLocation.longitude, nextUserLocation.latitude])
            .addTo(map);
        }

        markerData = nextMarkers;
        userLocationData = nextUserLocation ?? null;
      };

      const moveToRegion = (nextRegion, animated, durationOverride) => {
        const duration = Number.isFinite(durationOverride)
          ? durationOverride
          : defaultTransitionDurationMs;
        const camera = {
          center: [nextRegion.longitude, nextRegion.latitude],
          zoom: getZoomForRegion(nextRegion),
        };

        markProgrammaticMove(animated ? duration : 0);

        if (animated && duration > 0) {
          map.easeTo({
            ...camera,
            duration,
            easing: (progress) => progress,
          });
          return;
        }

        map.jumpTo(camera);
      };

      renderMarkers(markerData, userLocationData);

      window.__storyMapUpdate = (payload = {}) => {
        if (Array.isArray(payload.markers) || Object.prototype.hasOwnProperty.call(payload, 'userLocation')) {
          const nextMarkers = Array.isArray(payload.markers) ? payload.markers : markerData;
          const nextUserLocation = Object.prototype.hasOwnProperty.call(payload, 'userLocation')
            ? payload.userLocation
            : userLocationData;

          renderMarkers(nextMarkers, nextUserLocation);
        }

        if (payload.region) {
          moveToRegion(payload.region, payload.animated !== false, payload.transitionDurationMs);
        }
      };

      if (!interactive) {
        map.boxZoom.disable();
      }

      map.on('click', (event) => {
        if (!interactive) {
          return;
        }

        window.ReactNativeWebView?.postMessage(
          JSON.stringify({
            type: 'mapPress',
            latitude: event.lngLat.lat,
            longitude: event.lngLat.lng,
          })
        );
      });

      map.on('moveend', () => {
        if (!interactive) {
          return;
        }

        if (!hasCompletedInitialMove) {
          hasCompletedInitialMove = true;
          return;
        }

        if (isProgrammaticMove) {
          clearProgrammaticMove();
          return;
        }

        postCurrentRegion();
      });
    </script>
  </body>
</html>`;

export function WebMapView({
  region,
  markers = [],
  userLocation,
  interactive = true,
  onMarkerPress,
  onMapPress,
  onRegionChangeComplete,
  transitionDurationMs = 450,
}: WebMapViewProps) {
  const webViewRef = useRef<WebViewHandle | null>(null);
  const sourceRef = useRef<{ html: string } | null>(null);
  const latestUpdatePayloadRef = useRef<MapUpdatePayload | null>(null);

  if (sourceRef.current === null) {
    sourceRef.current = {
      html: mapHtml({ region, markers, userLocation, interactive, transitionDurationMs }),
    };
  }

  const updatePayload = {
    region,
    markers,
    userLocation: userLocation ?? null,
    animated: true,
    transitionDurationMs,
  };
  latestUpdatePayloadRef.current = updatePayload;

  useEffect(() => {
    injectMapUpdate(webViewRef.current, updatePayload);
  }, [markers, region, transitionDurationMs, userLocation]);

  return (
    <View style={styles.container}>
      <WebView
        ref={(ref: unknown) => {
          webViewRef.current = ref as WebViewHandle | null;
        }}
        originWhitelist={['*']}
        source={sourceRef.current}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        onLoadEnd={() => {
          if (latestUpdatePayloadRef.current) {
            injectMapUpdate(webViewRef.current, latestUpdatePayloadRef.current);
          }
        }}
        onMessage={(event: { nativeEvent: { data: string } }) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data);

            if (payload.type === 'markerPress' && typeof payload.markerId === 'string') {
              onMarkerPress?.(payload.markerId);
            }

            if (
              payload.type === 'mapPress' &&
              typeof payload.latitude === 'number' &&
              typeof payload.longitude === 'number'
            ) {
              onMapPress?.({
                latitude: payload.latitude,
                longitude: payload.longitude,
              });
            }

            if (
              payload.type === 'regionChange' &&
              typeof payload.latitude === 'number' &&
              typeof payload.longitude === 'number' &&
              typeof payload.latitudeDelta === 'number' &&
              typeof payload.longitudeDelta === 'number'
            ) {
              onRegionChangeComplete?.({
                latitude: payload.latitude,
                longitude: payload.longitude,
                latitudeDelta: payload.latitudeDelta,
                longitudeDelta: payload.longitudeDelta,
              });
            }
          } catch {
            return;
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

function injectMapUpdate(webView: WebViewHandle | null, payload: MapUpdatePayload) {
  webView?.injectJavaScript(
    `window.__storyMapUpdate && window.__storyMapUpdate(${escapeInjectedJson(payload)}); true;`,
  );
}

function escapeInjectedJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
