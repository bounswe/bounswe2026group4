import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import StoryPopup from "./StoryPopup";

// Fix Leaflet default marker icon paths for Vite bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const ISTANBUL_CENTER = [41.0082, 28.9784];
const DEFAULT_ZOOM = 12;

function MapView({ stories = [], loading = false }) {
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
        {stories.filter((story) => story.location_lat != null && story.location_lng != null).map((story) => (
          <Marker
            key={story.id}
            position={[story.location_lat, story.location_lng]}
            data-testid="map-marker"
          >
            <Popup>
              <StoryPopup story={story} />
            </Popup>
          </Marker>
        ))}
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
