import { useEffect, useMemo, useRef, useState } from "react";
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

import { Plus, Minus } from "lucide-react";

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
const KM_PER_LATITUDE_DEGREE = 111;
// Pads the radius circle bounds so the radius isn't flush with the viewport
// edge. This is a half-extent multiplier (applied per side), so a value of
// 1.2 yields a total span of 2.4× the radius — matching mobile's
// PROXIMITY_PADDING_FACTOR (2.4), which is expressed as a full-span factor.
const PROXIMITY_BOUNDS_PADDING_FACTOR = 1.2;
// Floor on the half-extent applied per side. Mobile clamps the full delta to
// MIN_LOCATION_DELTA (0.02), so the half-extent equivalent is 0.01.
const MIN_PROXIMITY_HALF_DELTA = 0.01;

// Intercepts clicks on internal app links inside popup HTML so they perform
// client-side navigation instead of a full page reload. Captures the
// current map URL (including search params) as `from` state so back-
// navigation preserves active filters.
// `/timeline?…` (with query string) is the only timeline target the popup
// builds, so anchor at the `?` to avoid catching unrelated paths like
// `/timelines/…` or `/timeline-of-events` if those ever exist.
const POPUP_LINK_SELECTOR = "a[href^='/stories/'], a[href^='/timeline?']";

function StoryLinkInterceptor() {
  const map = useMap();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const container = map?.getContainer?.();
    if (!container) return undefined;
    const from = `${location.pathname}${location.search}`;
    const handler = (event) => {
      const anchor = event.target.closest?.(POPUP_LINK_SELECTOR);
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

function isValidBbox(bbox) {
  return (
    bbox != null &&
    Number.isFinite(bbox.latMin) &&
    Number.isFinite(bbox.latMax) &&
    Number.isFinite(bbox.lngMin) &&
    Number.isFinite(bbox.lngMax)
  );
}

function isValidProximity(proximity) {
  return (
    proximity != null &&
    Number.isFinite(proximity.latitude) &&
    Number.isFinite(proximity.longitude) &&
    Number.isFinite(proximity.radiusKm) &&
    proximity.radiusKm > 0
  );
}

// Returns Leaflet bounds covering a circle of `radiusKm` around the given
// point. Mirrors mobile's getRegionForProximityFilter so both clients zoom to
// the same area for the same filter.
function proximityBounds({ latitude, longitude, radiusKm }) {
  const rawLatDelta = (radiusKm / KM_PER_LATITUDE_DEGREE) * PROXIMITY_BOUNDS_PADDING_FACTOR;
  const cosLat = Math.max(Math.cos((latitude * Math.PI) / 180), 0.2);
  const rawLngDelta = (radiusKm / (KM_PER_LATITUDE_DEGREE * cosLat)) * PROXIMITY_BOUNDS_PADDING_FACTOR;
  const latDelta = Math.max(rawLatDelta, MIN_PROXIMITY_HALF_DELTA);
  const lngDelta = Math.max(rawLngDelta, MIN_PROXIMITY_HALF_DELTA);
  return L.latLngBounds([
    [latitude - latDelta, longitude - lngDelta],
    [latitude + latDelta, longitude + lngDelta],
  ]);
}

function FitBoundsToFeatures({ features, bbox, proximity }) {
  const map = useMap();
  // Skip re-fitting when the inputs are unchanged — refetches that return the
  // same bbox + stories shouldn't snap the map back over the user's pan.
  const lastFitKeyRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    const hasBbox = isValidBbox(bbox);
    const hasProximity = !hasBbox && isValidProximity(proximity);
    if (!hasBbox && !hasProximity && features.length === 0) {
      lastFitKeyRef.current = null;
      return;
    }
    const bboxKey = hasBbox
      ? `${bbox.latMin}|${bbox.latMax}|${bbox.lngMin}|${bbox.lngMax}`
      : "";
    const proximityKey = hasProximity
      ? `${proximity.latitude}|${proximity.longitude}|${proximity.radiusKm}`
      : "";
    const featuresKey = features.map((f) => f.id).join("|");
    const fitKey = `${bboxKey}::${proximityKey}::${featuresKey}`;
    if (fitKey === lastFitKeyRef.current) return;
    lastFitKeyRef.current = fitKey;

    // Bbox takes priority so the user always sees the area they searched
    // for, even if no markers fall inside it. Proximity is the next-best
    // signal; markers are only used when neither is set.
    if (hasBbox) {
      const bounds = L.latLngBounds([
        [bbox.latMin, bbox.lngMin],
        [bbox.latMax, bbox.lngMax],
      ]);
      map.fitBounds(bounds, { padding: FIT_BOUNDS_PADDING });
      return;
    }
    if (hasProximity) {
      map.fitBounds(proximityBounds(proximity), { padding: FIT_BOUNDS_PADDING });
      return;
    }
    const latlngs = features.map(featureLatLng).filter(Boolean);
    if (latlngs.length === 0) return;
    const bounds = L.latLngBounds(latlngs);
    const options =
      latlngs.length === 1
        ? { maxZoom: SINGLE_FEATURE_MAX_ZOOM }
        : { padding: FIT_BOUNDS_PADDING };
    map.fitBounds(bounds, options);
  }, [map, features, bbox, proximity]);
  return null;
}

function ZoomButtons() {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const onZoomEnd = () => setZoom(map.getZoom());
    map.on("zoomend", onZoomEnd);
    return () => map.off("zoomend", onZoomEnd);
  }, [map]);

  const atMin = zoom <= map.getMinZoom();
  const atMax = zoom >= map.getMaxZoom();

  return (
    <div className="absolute bottom-6 right-3 z-[1000] flex flex-col gap-1">
      <button
        type="button"
        onClick={() => map.zoomIn()}
        aria-label="Zoom in"
        disabled={atMax}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-background shadow-md border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        aria-label="Zoom out"
        disabled={atMin}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-background shadow-md border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Minus className="h-4 w-4" />
      </button>
    </div>
  );
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
      marker.bindPopup(() => featurePopupHtml(feature));
      group.addLayer(marker);
    });
  }, [features]);

  return null;
}

function MapView({ featureCollection = EMPTY_FEATURE_COLLECTION, loading = false, bbox = null, proximity = null }) {
  const features = useMemo(
    () => featureCollection?.features ?? [],
    [featureCollection],
  );

  return (
    <div className="relative h-full w-full" data-testid="map-wrapper">
      <MapContainer
        center={ISTANBUL_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        className="h-full w-full"
        data-testid="map-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClusteredMarkers features={features} />
        <FitBoundsToFeatures features={features} bbox={bbox} proximity={proximity} />
        <StoryLinkInterceptor />
        <ZoomButtons />
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
