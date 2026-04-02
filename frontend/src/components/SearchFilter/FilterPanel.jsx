import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Collapsible filter panel for year range and location.
 * Maintains local form state; commits to URL only on "Apply".
 * The parent should pass a `key` tied to the current filter values so that
 * the component resets its local form whenever filters are cleared externally.
 */
function FilterPanel({ yearFrom = "", yearTo = "", location = "", onApply, activeCount = 0 }) {
  const [open, setOpen] = useState(false);
  const [localYearFrom, setLocalYearFrom] = useState(yearFrom);
  const [localYearTo, setLocalYearTo] = useState(yearTo);
  const [localLocation, setLocalLocation] = useState(location);
  const [yearError, setYearError] = useState("");

  function handleApply() {
    const from = localYearFrom === "" ? "" : Number(localYearFrom);
    const to = localYearTo === "" ? "" : Number(localYearTo);

    if ((from !== "" && from < 1) || (to !== "" && to < 1)) {
      setYearError("Year must be a positive number.");
      return;
    }
    if (from !== "" && to !== "" && from > to) {
      setYearError("'From' year must not exceed 'To' year.");
      return;
    }
    setYearError("");
    onApply({ yearFrom: from, yearTo: to, location: localLocation.trim() });
    setOpen(false);
  }

  function handleReset() {
    setLocalYearFrom("");
    setLocalYearTo("");
    setLocalLocation("");
    setYearError("");
    onApply({ yearFrom: "", yearTo: "", location: "" });
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
                    onChange={(e) => {
                      setLocalYearFrom(e.target.value);
                      setYearError("");
                    }}
                    min="1"
                    max="2999"
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
                    onChange={(e) => {
                      setLocalYearTo(e.target.value);
                      setYearError("");
                    }}
                    min="1"
                    max="2999"
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
              <Input
                id="location-filter"
                type="text"
                placeholder="Neighbourhood, district, city…"
                value={localLocation}
                onChange={(e) => setLocalLocation(e.target.value)}
                aria-label="Location filter"
              />
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
