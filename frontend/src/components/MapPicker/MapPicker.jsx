import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix default marker icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const ISTANBUL_CENTER = [41.0082, 28.9784];
const DEFAULT_ZOOM = 12;

function ClickHandler({ onChange }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function MapPicker({ value, onChange }) {
  return (
    <div>
      <MapContainer
        center={ISTANBUL_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: "300px", width: "100%" }}
        className="rounded-md border"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onChange={onChange} />
        {value && <Marker position={[value.lat, value.lng]} />}
      </MapContainer>
      <p className="mt-1 text-sm text-muted-foreground">
        {value
          ? `Selected: ${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`
          : "Click on the map to select a location"}
      </p>
    </div>
  );
}

export default MapPicker;
