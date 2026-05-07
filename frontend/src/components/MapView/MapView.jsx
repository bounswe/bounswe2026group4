import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useNavigate, useLocation } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import { EMPTY_FEATURE_COLLECTION } from "@/services/storyService";
import { featurePopupHtml } from "./mapFeatureUtils";

// Fix Leaflet default marker icon paths for Vite bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const ISTANBUL_CENTER = [41.0082, 28.9784];
const DEFAULT_ZOOM = 12;
const SINGLE_FEATURE_MAX_ZOOM = 15;
const FIT_BOUNDS_PADDING = [40, 40];

// Intercepts clicks on story links inside popup HTML so they perform
// client-side navigation instead of a full page reload. Captures the
// current map URL (including search params) as `from` state so back-
// navigation preserves active filters.
function StoryLinkInterceptor() {
  const map = useMap();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const container = map?.getContainer?.();
    if (!container) return undefined;
    const from = `${location.pathname}${location.search}`;
    const handler = (event) => {
      const anchor = event.target.closest?.("a[href^='/stories/']");
      if (!anchor || event.defaultPrevented) return;
      event.preventDefault();
      navigate(anchor.getAttribute("href"), { state: { from } });
    };
    container.addEventListener("click", handler);
    return () => container.removeEventListener("click", handler);
  }, [map, navigate, location.pathname, location.search]);
  return null;
}

function featureLatLng(feature) {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords;
  return [lat, lng];
}

function FitBoundsToFeatures({ features }) {
  const map = useMap();
  useEffect(() => {
    if (!map || features.length === 0) return;
    const latlngs = features.map(featureLatLng).filter(Boolean);
    if (latlngs.length === 0) return;
    const bounds = L.latLngBounds(latlngs);
    const options =
      latlngs.length === 1
        ? { maxZoom: SINGLE_FEATURE_MAX_ZOOM }
        : { padding: FIT_BOUNDS_PADDING };
    map.fitBounds(bounds, options);
  }, [map, features]);
  return null;
}

function ClusteredMarkers({ features }) {
  const map = useMap();
  const groupRef = useRef(null);

  useEffect(() => {
    if (!map) return undefined;
    const group = L.markerClusterGroup();
    groupRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();
    features.forEach((feature) => {
      const latlng = featureLatLng(feature);
      if (!latlng) return;
      const marker = L.marker(latlng);
      marker.bindPopup(featurePopupHtml(feature));
      group.addLayer(marker);
    });
  }, [features]);

  return null;
}

function MapView({ featureCollection = EMPTY_FEATURE_COLLECTION, loading = false }) {
  const features = useMemo(
    () => featureCollection?.features ?? [],
    [featureCollection],
  );

  return (
    <div className="relative h-full w-full" data-testid="map-wrapper">
      <MapContainer
        center={ISTANBUL_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        data-testid="map-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClusteredMarkers features={features} />
        <FitBoundsToFeatures features={features} />
        <StoryLinkInterceptor />
      </MapContainer>
      {loading && (
        <div
          className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/50"
          aria-label="Loading map pins"
          role="status"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      )}
    </div>
  );
}

export default MapView;
