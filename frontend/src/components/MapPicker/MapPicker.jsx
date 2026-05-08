import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useLocationSuggestions } from "@/hooks/useLocationSuggestions";
import { cn } from "@/lib/utils";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const ISTANBUL_CENTER = [41.0082, 28.9784];
const DEFAULT_ZOOM = 12;
const SELECTED_ZOOM = 15;

function bboxCenter(bbox) {
  return {
    lat: (bbox.latMin + bbox.latMax) / 2,
    lng: (bbox.lngMin + bbox.lngMax) / 2,
  };
}

function ClickHandler({ onChange }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// Imperatively pans/zooms the map when `target` changes. A null target keeps
// the current view (used on mount and during manual click-to-drop so the user
// isn't snapped back).
function MapController({ target }) {
  const map = useMap();
  const lastTargetRef = useRef(null);
  useEffect(() => {
    if (!map || !target || target === lastTargetRef.current) return;
    lastTargetRef.current = target;
    map.setView([target.lat, target.lng], target.zoom ?? SELECTED_ZOOM);
  }, [map, target]);
  return null;
}

function MapPicker({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [target, setTarget] = useState(null);
  const containerRef = useRef(null);

  const { suggestions, isLoading, clearSuggestions } = useLocationSuggestions(query);

  // Dismiss the suggestions panel when clicking outside the search field.
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        clearSuggestions();
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [clearSuggestions]);

  function selectSuggestion(s) {
    const center = bboxCenter(s.bbox);
    setQuery(s.title);
    clearSuggestions();
    setActiveIndex(-1);
    onChange(center);
    setTarget({ ...center, zoom: SELECTED_ZOOM });
  }

  function handleKeyDown(e) {
    if (suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      clearSuggestions();
      setActiveIndex(-1);
    }
  }

  const trimmed = query.trim();
  const showNoResults =
    trimmed.length >= 3 && !isLoading && suggestions.length === 0;

  return (
    <>
      <div className="relative mb-2" ref={containerRef}>
        <Input
          type="text"
          placeholder="Search for an address or place…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          aria-label="Search for a location"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          aria-activedescendant={
            activeIndex >= 0
              ? `mappicker-suggestion-${suggestions[activeIndex]?.id}`
              : undefined
          }
          autoComplete="off"
          className={isLoading ? "pr-8" : ""}
        />
        {isLoading && (
          <Loader2
            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
        {suggestions.length > 0 && (
          <ul
            role="listbox"
            aria-label="Location suggestions"
            className="absolute left-0 right-0 top-full z-[1100] mt-1 max-h-56 overflow-y-auto rounded-md border bg-background shadow-md"
          >
            {suggestions.map((s, i) => (
              <li
                key={s.id}
                id={`mappicker-suggestion-${s.id}`}
                role="option"
                aria-selected={i === activeIndex}
              >
                <button
                  type="button"
                  // mousedown fires before blur, so handle the select here to
                  // prevent the input losing focus and dismissing the listbox.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion(s);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none",
                    i === activeIndex && "bg-accent"
                  )}
                >
                  <div className="truncate text-sm font-medium">{s.title}</div>
                  {s.subtitle && (
                    <div className="truncate text-xs text-muted-foreground">
                      {s.subtitle}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {showNoResults && (
          <p
            role="status"
            aria-live="polite"
            className="mt-1 text-xs text-muted-foreground"
          >
            No results found.
          </p>
        )}
      </div>

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
        <MapController target={target} />
        {value && <Marker position={[value.lat, value.lng]} />}
      </MapContainer>
      <p className="mt-1 text-sm text-muted-foreground">
        {value
          ? `Selected: ${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`
          : "Search above or click on the map to select a location"}
      </p>
    </>
  );
}

export default MapPicker;
