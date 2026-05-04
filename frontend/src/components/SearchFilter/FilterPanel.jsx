import { useState, useRef, useEffect } from "react";
import { SlidersHorizontal, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLocationSuggestions } from "@/hooks/useLocationSuggestions";

const YEAR_MIN = 1000;
const YEAR_MAX = 2030;
const YEAR_SPINNER_FROM = 1980;
const YEAR_SPINNER_TO = new Date().getFullYear();

/**
 * Collapsible filter panel for year range and location.
 * Maintains local form state; commits to URL only on "Apply".
 * The parent should pass a `key` tied to the current filter values so that
 * the component resets its local form whenever filters are cleared externally.
 */
function FilterPanel({ yearFrom = "", yearTo = "", location = "", latMin = null, latMax = null, lngMin = null, lngMax = null, onApply, activeCount = 0 }) {
  const [open, setOpen] = useState(false);
  const [localYearFrom, setLocalYearFrom] = useState(yearFrom);
  const [localYearTo, setLocalYearTo] = useState(yearTo);
  const [localLocation, setLocalLocation] = useState(location);
  const [suggestionsQuery, setSuggestionsQuery] = useState("");
  const [yearError, setYearError] = useState("");
  const [lockedBbox, setLockedBbox] = useState(
    () => latMin != null && latMax != null && lngMin != null && lngMax != null
      ? { latMin, latMax, lngMin, lngMax }
      : null
  );
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
    });
    setOpen(false);
  }

  function handleReset() {
    setLocalYearFrom("");
    setLocalYearTo("");
    setLocalLocation("");
    setSuggestionsQuery("");
    setLockedBbox(null);
    setYearError("");
    clearSuggestions();
    onApply({ yearFrom: "", yearTo: "", location: "", latMin: null, latMax: null, lngMin: null, lngMax: null });
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
