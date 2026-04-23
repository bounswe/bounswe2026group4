import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import { useNavigate, useLocation } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import { EMPTY_FEATURE_COLLECTION } from "@/services/storyService";
import { pointToLayer, onEachFeature } from "./mapFeatureUtils";

// Fix Leaflet default marker icon paths for Vite bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const ISTANBUL_CENTER = [41.0082, 28.9784];
const DEFAULT_ZOOM = 12;

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

function MapView({ featureCollection = EMPTY_FEATURE_COLLECTION, loading = false }) {
  const features = useMemo(
    () => featureCollection?.features ?? [],
    [featureCollection],
  );
  // react-leaflet's <GeoJSON> only initializes the layer once, so force a
  // remount whenever the feature set changes (filter/search results).
  const geoJSONKey = useMemo(
    () => features.map((f) => f.id).join("|"),
    [features],
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
        {features.length > 0 && (
          <GeoJSON
            key={geoJSONKey}
            data={featureCollection}
            pointToLayer={pointToLayer}
            onEachFeature={onEachFeature}
          />
        )}
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
