import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

type MarkerItem = {
  id: string;
  latitude: number;
  longitude: number;
  selected?: boolean;
  label?: string;
};

interface RegionLike {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface WebMapViewProps {
  region: RegionLike;
  markers?: MarkerItem[];
  interactive?: boolean;
  onMarkerPress?: (markerId: string) => void;
  onMapPress?: (coords: { latitude: number; longitude: number }) => void;
}

const mapHtml = ({
  region,
  markers,
  interactive,
}: {
  region: RegionLike;
  markers: MarkerItem[];
  interactive: boolean;
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
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
    <script>
      const region = ${JSON.stringify(region)};
      const markers = ${JSON.stringify(markers)};
      const interactive = ${interactive ? 'true' : 'false'};

      const zoom = Math.max(
        2,
        Math.min(
          16,
          Math.round(Math.log2(360 / Math.max(region.longitudeDelta, 0.0001)))
        )
      );

      const map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [region.longitude, region.latitude],
        zoom,
        attributionControl: true,
        dragPan: interactive,
        scrollZoom: interactive,
        doubleClickZoom: interactive,
        touchZoomRotate: interactive,
        dragRotate: false,
        pitchWithRotate: false,
        keyboard: false,
      });

      map.addControl(new maplibregl.AttributionControl({ compact: true }));

      markers.forEach((marker) => {
        const element = document.createElement('div');
        element.className = marker.selected ? 'marker selected' : 'marker';
        element.addEventListener('click', () => {
          window.ReactNativeWebView?.postMessage(
            JSON.stringify({ type: 'markerPress', markerId: marker.id })
          );
        });

        new maplibregl.Marker({ element, anchor: 'center' })
          .setLngLat([marker.longitude, marker.latitude])
          .addTo(map);
      });

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
    </script>
  </body>
</html>`;

export function WebMapView({
  region,
  markers = [],
  interactive = true,
  onMarkerPress,
  onMapPress,
}: WebMapViewProps) {
  const source = useMemo(
    () => ({
      html: mapHtml({ region, markers, interactive }),
    }),
    [interactive, markers, region],
  );

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={source}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
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
