import { useState, useRef, useEffect } from "react";
import { SlidersHorizontal, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLocationSuggestions } from "@/hooks/useLocationSuggestions";
import { getCurrentDeviceCoordinates } from "@/services/deviceLocationService";
import TagFilterInput from "./TagFilterInput";

const YEAR_MIN = 1000;
const YEAR_MAX = 2030;
const YEAR_SPINNER_FROM = 1980;
const YEAR_SPINNER_TO = new Date().getFullYear();

const PROXIMITY_OPTIONS = [
  { value: null, label: "Anywhere" },
  { value: 0.5, label: "500 m" },
  { value: 1, label: "1 km" },
  { value: 10, label: "10 km" },
  { value: 100, label: "100 km" },
];

/**
 * Collapsible filter panel for year range, location, and tags.
 * Maintains local form state; commits to URL only on "Apply".
 * The parent should pass a `key` tied to the current filter values so that
 * the component resets its local form whenever filters are cleared externally.
 */
function FilterPanel({ yearFrom = "", yearTo = "", location = "", latMin = null, latMax = null, lngMin = null, lngMax = null, latitude = null, longitude = null, radiusKm = null, tags = [], hasImage = false, onApply, activeCount = 0, hideYearRange = false, showHasImage = false }) {
  const [open, setOpen] = useState(false);
  const [localYearFrom, setLocalYearFrom] = useState(yearFrom);
  const [localYearTo, setLocalYearTo] = useState(yearTo);
  const [localLocation, setLocalLocation] = useState(location);
  const [suggestionsQuery, setSuggestionsQuery] = useState("");
  const [localTags, setLocalTags] = useState(tags);
  const [localHasImage, setLocalHasImage] = useState(hasImage);
  const [yearError, setYearError] = useState("");
  const [lockedBbox, setLockedBbox] = useState(
    () => latMin != null && latMax != null && lngMin != null && lngMax != null
      ? { latMin, latMax, lngMin, lngMax }
      : null
  );
  const [localRadiusKm, setLocalRadiusKm] = useState(radiusKm);
  const [localCoords, setLocalCoords] = useState(
    () => (latitude != null && longitude != null ? { latitude, longitude } : null)
  );
  const [proximityResolving, setProximityResolving] = useState(false);
  const [proximityStatus, setProximityStatus] = useState(
    radiusKm != null && latitude != null && longitude != null
      ? { kind: "ok", message: "Using your current location." }
      : null
  );
  const proximityRequestIdRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(-1);

  const locationRef = useRef(null);

  const { suggestions, isLoading: isSuggestionsLoading, clearSuggestions } = useLocationSuggestions(suggestionsQuery);

  // Dismiss suggestions when clicking outside the location field.
  useEffect(() => {
    function handleClickOutside(e) {
      if (locationRef.current && !locationRef.current.contains(e.target)) {
        clearSuggestions();
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [clearSuggestions]);

  function clampYear(value) {
    if (value === "") return value;
    const num = Number(value);
    if (isNaN(num)) return value;
    return num > YEAR_MAX ? YEAR_MAX : num;
  }

  function handleLocationChange(value) {
    setLocalLocation(value);
    setSuggestionsQuery(value);
    setLockedBbox(null);
    setActiveIndex(-1);
  }

  function handleSuggestionSelect(suggestion) {
    setLocalLocation(suggestion.title);
    setSuggestionsQuery(""); // prevent hook from refiring on the selected title
    setLockedBbox(suggestion.bbox ?? null);
    clearSuggestions();
    setActiveIndex(-1);
  }

  function handleLocationKeyDown(e) {
    if (suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSuggestionSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      clearSuggestions();
      setActiveIndex(-1);
    }
  }

  async function handleProximityRadiusChange(nextRadiusKm) {
    const requestId = proximityRequestIdRef.current + 1;
    proximityRequestIdRef.current = requestId;
    setLocalRadiusKm(nextRadiusKm);

    if (nextRadiusKm == null) {
      setLocalCoords(null);
      setProximityResolving(false);
      setProximityStatus(null);
      return;
    }

    // Reuse coordinates if we already have them so toggling between radii
    // doesn't re-prompt the user for permission on every click.
    if (localCoords) {
      setProximityStatus({ kind: "ok", message: "Using your current location." });
      return;
    }

    setProximityResolving(true);
    setProximityStatus({ kind: "info", message: "Fetching your current location..." });

    const result = await getCurrentDeviceCoordinates();

    // Bail out if a newer change has been issued (e.g. user clicked Anywhere
    // before the position came back).
    if (proximityRequestIdRef.current !== requestId) return;

    setProximityResolving(false);

    if (result.status === "granted") {
      setLocalCoords(result.coordinates);
      setProximityStatus({ kind: "ok", message: "Using your current location." });
      return;
    }

    // Keep the radius selected so the user can retry by clicking another
    // option — switching them back to Anywhere makes the filter feel broken.
    // Apply gates on coords being present, so a selected-but-unresolved
    // radius stays a no-op until a future attempt succeeds.
    setLocalCoords(null);
    setProximityStatus({
      kind: "error",
      message:
        result.status === "denied"
          ? "Location disabled. Enable location permission, then pick a radius again."
          : "Current location is unavailable. Try again or choose Anywhere.",
    });
  }

  function handleApply() {
    const from = localYearFrom === "" ? "" : Number(localYearFrom);
    const to = localYearTo === "" ? "" : Number(localYearTo);

    if ((from !== "" && (isNaN(from) || from < YEAR_MIN)) || (to !== "" && (isNaN(to) || to < YEAR_MIN))) {
      setYearError(`Year must be ${YEAR_MIN} or later.`);
      return;
    }
    if (from !== "" && to !== "" && from > to) {
      setYearError("'From' year must not exceed 'To' year.");
      return;
    }

    // Only use a bbox if the user explicitly selected a suggestion.
    const effectiveBbox = lockedBbox;
    const proximityActive = localRadiusKm != null && localCoords != null;

    // If a radius was picked but coords never resolved (e.g. permission denied),
    // the URL will emit all-null proximity. Clear local state too so reopening
    // the panel doesn't show a stale selection + lingering error.
    if (!proximityActive) {
      proximityRequestIdRef.current += 1;
      setLocalRadiusKm(null);
      setLocalCoords(null);
      setProximityResolving(false);
      setProximityStatus(null);
    }

    setYearError("");
    clearSuggestions();
    onApply({
      yearFrom: from,
      yearTo: to,
      location: localLocation.trim(),
      latMin: effectiveBbox?.latMin ?? null,
      latMax: effectiveBbox?.latMax ?? null,
      lngMin: effectiveBbox?.lngMin ?? null,
      lngMax: effectiveBbox?.lngMax ?? null,
      latitude: proximityActive ? localCoords.latitude : null,
      longitude: proximityActive ? localCoords.longitude : null,
      radiusKm: proximityActive ? localRadiusKm : null,
      tags: localTags,
      ...(showHasImage ? { hasImage: localHasImage } : {}),
    });
    setOpen(false);
  }

  function handleReset() {
    proximityRequestIdRef.current += 1;
    setLocalYearFrom("");
    setLocalYearTo("");
    setLocalLocation("");
    setSuggestionsQuery("");
    setLockedBbox(null);
    setLocalRadiusKm(null);
    setLocalCoords(null);
    setProximityResolving(false);
    setProximityStatus(null);
    setLocalTags([]);
    setLocalHasImage(false);
    setYearError("");
    clearSuggestions();
    onApply({
      yearFrom: "",
      yearTo: "",
      location: "",
      latMin: null,
      latMax: null,
      lngMin: null,
      lngMax: null,
      latitude: null,
      longitude: null,
      radiusKm: null,
      tags: [],
      ...(showHasImage ? { hasImage: false } : {}),
    });
    setOpen(false);
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="filter-panel"
        aria-label={activeCount > 0 ? `Filters (${activeCount} active)` : "Filters"}
      >
        <SlidersHorizontal className="h-4 w-4 mr-1.5" aria-hidden="true" />
        Filters
        {activeCount > 0 && (
          <span
            className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground"
            aria-hidden="true"
          >
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          id="filter-panel"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border bg-background p-4 shadow-lg"
          role="region"
          aria-label="Filter options"
        >
          <div className="space-y-4">
            {/* Year range */}
            {!hideYearRange && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Year range</legend>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label htmlFor="year-from" className="sr-only">
                    From year
                  </Label>
                  <Input
                    id="year-from"
                    type="number"
                    placeholder="From"
                    value={localYearFrom}
                    onKeyDown={(e) => {
                      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && localYearFrom === "") {
                        e.preventDefault();
                        setLocalYearFrom(YEAR_SPINNER_FROM);
                        setYearError("");
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") { setLocalYearFrom(""); setYearError(""); return; }
                      // When mouse-spinner is clicked on empty field the browser fires YEAR_MIN; override with default
                      if (localYearFrom === "" && Number(val) === YEAR_MIN) {
                        setLocalYearFrom(YEAR_SPINNER_FROM);
                      } else {
                        setLocalYearFrom(clampYear(val));
                      }
                      setYearError("");
                    }}
                    min={YEAR_MIN}
                    max={YEAR_MAX}
                    aria-label="From year"
                  />
                </div>
                <span className="text-sm text-muted-foreground" aria-hidden="true">
                  &ndash;
                </span>
                <div className="flex-1">
                  <Label htmlFor="year-to" className="sr-only">
                    To year
                  </Label>
                  <Input
                    id="year-to"
                    type="number"
                    placeholder="To"
                    value={localYearTo}
                    onKeyDown={(e) => {
                      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && localYearTo === "") {
                        e.preventDefault();
                        setLocalYearTo(YEAR_SPINNER_TO);
                        setYearError("");
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") { setLocalYearTo(""); setYearError(""); return; }
                      // When mouse-spinner is clicked on empty field the browser fires YEAR_MIN; override with default
                      if (localYearTo === "" && Number(val) === YEAR_MIN) {
                        setLocalYearTo(YEAR_SPINNER_TO);
                      } else {
                        setLocalYearTo(clampYear(val));
                      }
                      setYearError("");
                    }}
                    min={YEAR_MIN}
                    max={YEAR_MAX}
                    aria-label="To year"
                  />
                </div>
              </div>
              {yearError && (
                <p className="mt-1 text-xs text-destructive" role="alert">
                  {yearError}
                </p>
              )}
            </fieldset>
            )}

            {/* Location */}
            <div>
              <Label
                htmlFor="location-filter"
                className="mb-1.5 block text-sm font-medium"
              >
                Location
              </Label>
              <div className="relative" ref={locationRef}>
                <Input
                  id="location-filter"
                  type="text"
                  placeholder="Neighbourhood, district, city…"
                  value={localLocation}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  onKeyDown={handleLocationKeyDown}
                  aria-label="Location filter"
                  aria-autocomplete="list"
                  aria-expanded={suggestions.length > 0}
                  aria-activedescendant={activeIndex >= 0 ? `suggestion-${suggestions[activeIndex]?.id}` : undefined}
                  autoComplete="off"
                  className={isSuggestionsLoading ? "pr-8" : ""}
                />
                {isSuggestionsLoading && (
                  <Loader2
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                {suggestions.length > 0 && (
                  <ul
                    role="listbox"
                    aria-label="Location suggestions"
                    className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-48 overflow-y-auto rounded-md border bg-background shadow-md"
                  >
                    {suggestions.map((s, i) => (
                      <li key={s.id} id={`suggestion-${s.id}`} role="option" aria-selected={i === activeIndex}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            // mousedown fires before blur; prevent input from losing focus first
                            e.preventDefault();
                            handleSuggestionSelect(s);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none",
                            i === activeIndex && "bg-accent"
                          )}
                        >
                          <div className="text-sm font-medium truncate">{s.title}</div>
                          {s.subtitle && (
                            <div className="text-xs text-muted-foreground truncate">{s.subtitle}</div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Distance / proximity */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Distance</legend>
              <div
                role="radiogroup"
                aria-label="Distance from current location"
                className="flex flex-wrap gap-1.5"
              >
                {PROXIMITY_OPTIONS.map((option) => {
                  const isSelected = localRadiusKm === option.value;
                  const id = `proximity-${option.value ?? "off"}`;
                  return (
                    <label
                      key={id}
                      htmlFor={id}
                      className={cn(
                        "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background hover:bg-accent"
                      )}
                    >
                      <input
                        id={id}
                        type="radio"
                        name="proximity-radius"
                        className="sr-only"
                        checked={isSelected}
                        onChange={() => handleProximityRadiusChange(option.value)}
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
              {(proximityResolving || proximityStatus) && (
                <p
                  className={cn(
                    "mt-2 flex items-center gap-1.5 text-xs",
                    proximityStatus?.kind === "error"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                  role={proximityStatus?.kind === "error" ? "alert" : undefined}
                  aria-live="polite"
                >
                  {proximityResolving && (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  )}
                  {proximityStatus?.message}
                </p>
              )}
            </fieldset>

            {/* Tags */}
            <TagFilterInput value={localTags} onChange={setLocalTags} />

            {showHasImage && (
              <fieldset>
                <legend className="sr-only">Image presence</legend>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={localHasImage}
                    onChange={(e) => setLocalHasImage(e.target.checked)}
                    aria-label="Only stories with an image"
                    className="h-4 w-4 rounded border-input"
                  />
                  <span>Only stories with an image</span>
                </label>
              </fieldset>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
                Reset filters
              </Button>
              <Button type="button" size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterPanel;
