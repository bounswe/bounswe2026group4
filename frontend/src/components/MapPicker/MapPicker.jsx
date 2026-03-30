import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
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
        center={value ? [value.lat, value.lng] : ISTANBUL_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: "300px", width: "100%" }}
        className="rounded-md border"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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
