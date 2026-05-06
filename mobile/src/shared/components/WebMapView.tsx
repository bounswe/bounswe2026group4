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
  onMapGestureChange?: (isGestureActive: boolean) => void;
  onRegionChangeComplete?: (region: RegionLike) => void;
  transitionDurationMs?: number;
}

type WebViewHandle = {
  injectJavaScript: (script: string) => void;
};

type MapUpdatePayload = {
  region?: RegionLike;
  markers?: MarkerItem[];
  userLocation?: UserLocationLike | null;
  animated?: boolean;
  transitionDurationMs?: number;
};

const MAP_HTML_VERSION = 'current-location-pin-size-v2';

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
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .marker.selected {
        width: 34px;
        height: 34px;
      }

      .marker-dot {
        position: relative;
        width: 18px;
        height: 18px;
        border-radius: 9999px;
        background: #404040;
        border: 3px solid #ffffff;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
      }

      .marker-pin {
        position: relative;
        width: 24px;
        height: 24px;
        border-radius: 50% 50% 50% 0;
        background: #dc2626;
        border: 3px solid #ffffff;
        transform: rotate(-45deg);
        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.32);
      }

      .marker.selected .marker-pin {
        width: 18px;
        height: 18px;
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

      .marker-pin .marker-label {
        transform: translate(-50%, -50%) rotate(45deg);
      }

      .user-location-marker {
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .user-location-pin {
        position: relative;
        width: 28px;
        height: 28px;
        box-sizing: border-box;
        border-radius: 50% 50% 50% 0;
        background: #1d4ed8;
        border: 3px solid #ffffff;
        transform: rotate(-45deg);
        transform-origin: center;
        box-shadow:
          0 0 0 7px rgba(29, 78, 216, 0.18),
          0 4px 12px rgba(29, 78, 216, 0.34);
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
      let isMapReady = false;
      let isProgrammaticMove = false;
      let programmaticMoveTimer;
      let markerInstances = [];
      let pendingUpdatePayload = null;
      let userLocationMarker = null;
      let mapGestureReleaseTimer = null;

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

      const postMapGestureChange = (isActive) => {
        if (mapGestureReleaseTimer) {
          window.clearTimeout(mapGestureReleaseTimer);
          mapGestureReleaseTimer = null;
        }

        window.ReactNativeWebView?.postMessage(
          JSON.stringify({ type: 'mapGesture', isActive })
        );

        if (isActive) {
          mapGestureReleaseTimer = window.setTimeout(() => {
            window.ReactNativeWebView?.postMessage(
              JSON.stringify({ type: 'mapGesture', isActive: false })
            );
            mapGestureReleaseTimer = null;
          }, 1200);
        }
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
        const markerBody = document.createElement('div');
        markerBody.className = marker.selected ? 'marker-pin' : 'marker-dot';
        element.appendChild(markerBody);

        if (marker.label) {
          const label = document.createElement('span');
          label.className = 'marker-label';
          label.textContent = marker.label;
          markerBody.appendChild(label);
        }

        element.addEventListener('click', (event) => {
          event.stopPropagation();
          window.ReactNativeWebView?.postMessage(
            JSON.stringify({ type: 'markerPress', markerId: marker.id })
          );
        });

        return new maplibregl.Marker({ element, anchor: marker.selected ? 'bottom' : 'center' })
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
          const markerBody = document.createElement('div');
          markerBody.className = 'user-location-pin';
          element.appendChild(markerBody);

          userLocationMarker = new maplibregl.Marker({ element, anchor: 'bottom' })
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

      const applyMapUpdate = (payload = {}) => {
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

      renderMarkers(markerData, userLocationData);

      window.__storyMapUpdate = (payload = {}) => {
        if (!isMapReady) {
          pendingUpdatePayload = {
            ...(pendingUpdatePayload ?? {}),
            ...payload,
          };
          return;
        }

        applyMapUpdate(payload);
      };

      if (!interactive) {
        map.boxZoom.disable();
      }

      const mapCanvas = map.getCanvas();
      mapCanvas.addEventListener('touchstart', () => postMapGestureChange(true), { passive: true });
      mapCanvas.addEventListener('touchmove', () => postMapGestureChange(true), { passive: true });
      mapCanvas.addEventListener('touchend', () => postMapGestureChange(false), { passive: true });
      mapCanvas.addEventListener('touchcancel', () => postMapGestureChange(false), { passive: true });
      mapCanvas.addEventListener('pointerdown', () => postMapGestureChange(true));
      mapCanvas.addEventListener('pointermove', () => postMapGestureChange(true));
      mapCanvas.addEventListener('pointerup', () => postMapGestureChange(false));
      mapCanvas.addEventListener('pointercancel', () => postMapGestureChange(false));

      map.on('dragstart', () => postMapGestureChange(true));
      map.on('dragend', () => postMapGestureChange(false));

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

      map.on('load', () => {
        isMapReady = true;
        hasCompletedInitialMove = true;

        if (pendingUpdatePayload) {
          applyMapUpdate(pendingUpdatePayload);
          pendingUpdatePayload = null;
        }
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
  onMapGestureChange,
  onRegionChangeComplete,
  transitionDurationMs = 450,
}: WebMapViewProps) {
  const webViewRef = useRef<WebViewHandle | null>(null);
  const sourceRef = useRef<{ html: string; version: string } | null>(null);
  const latestUpdatePayloadRef = useRef<MapUpdatePayload | null>(null);
  const lastSentRegionRef = useRef<RegionLike | null>(null);
  const lastSentMarkersRef = useRef<MarkerItem[] | null>(null);
  const lastSentUserLocationRef = useRef<UserLocationLike | null | undefined>(undefined);

  if (sourceRef.current === null || sourceRef.current.version !== MAP_HTML_VERSION) {
    sourceRef.current = {
      html: mapHtml({ region, markers, userLocation, interactive, transitionDurationMs }),
      version: MAP_HTML_VERSION,
    };
  }

  const fullUpdatePayload = {
    region,
    markers,
    userLocation: userLocation ?? null,
    animated: true,
    transitionDurationMs,
  };
  latestUpdatePayloadRef.current = fullUpdatePayload;

  useEffect(() => {
    const updatePayload: MapUpdatePayload = {};
    const nextUserLocation = userLocation ?? null;

    if (!lastSentRegionRef.current || !regionsEqual(lastSentRegionRef.current, region)) {
      updatePayload.region = region;
      updatePayload.animated = true;
      updatePayload.transitionDurationMs = transitionDurationMs;
      lastSentRegionRef.current = region;
    }

    if (!lastSentMarkersRef.current || !markersEqual(lastSentMarkersRef.current, markers)) {
      updatePayload.markers = markers;
      lastSentMarkersRef.current = markers;
    }

    if (
      lastSentUserLocationRef.current === undefined ||
      !userLocationsEqual(lastSentUserLocationRef.current, nextUserLocation)
    ) {
      updatePayload.userLocation = nextUserLocation;
      lastSentUserLocationRef.current = nextUserLocation;
    }

    if (Object.keys(updatePayload).length > 0) {
      injectMapUpdate(webViewRef.current, updatePayload);
    }
  }, [markers, region, transitionDurationMs, userLocation]);

  return (
    <View testID="web-map-view" style={styles.container}>
      <WebView
        ref={(ref: unknown) => {
          webViewRef.current = ref as WebViewHandle | null;
        }}
        originWhitelist={['*']}
        source={{ html: sourceRef.current.html }}
        key={sourceRef.current.version}
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
              const nextRegion = {
                latitude: payload.latitude,
                longitude: payload.longitude,
                latitudeDelta: payload.latitudeDelta,
                longitudeDelta: payload.longitudeDelta,
              };

              lastSentRegionRef.current = nextRegion;
              onRegionChangeComplete?.(nextRegion);
            }

            if (payload.type === 'mapGesture' && typeof payload.isActive === 'boolean') {
              onMapGestureChange?.(payload.isActive);
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

function regionsEqual(left: RegionLike, right: RegionLike) {
  return (
    left.latitude === right.latitude &&
    left.longitude === right.longitude &&
    left.latitudeDelta === right.latitudeDelta &&
    left.longitudeDelta === right.longitudeDelta
  );
}

function userLocationsEqual(left: UserLocationLike | null, right: UserLocationLike | null) {
  if (left === null || right === null) {
    return left === right;
  }

  return left.latitude === right.latitude && left.longitude === right.longitude;
}

function markersEqual(left: MarkerItem[], right: MarkerItem[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((marker, index) => {
    const nextMarker = right[index];

    return (
      marker.id === nextMarker.id &&
      marker.latitude === nextMarker.latitude &&
      marker.longitude === nextMarker.longitude &&
      marker.selected === nextMarker.selected &&
      marker.label === nextMarker.label
    );
  });
}

function escapeInjectedJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
