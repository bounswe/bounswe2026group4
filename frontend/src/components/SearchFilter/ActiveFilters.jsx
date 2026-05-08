import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTagColorClass } from "@/utils/tagUtils";
import { cn } from "@/lib/utils";

function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-sm font-medium">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label={`Remove filter: ${label}`}
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}

function TagChip({ name, onRemove }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        getTagColorClass(name)
      )}
    >
      {name}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 hover:opacity-70 focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label={`Remove tag filter: ${name}`}
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}

/**
 * Renders removable chips for each active search/filter value.
 * Returns null when no filters are active.
 *
 * onRemove receives a key: "q" | "year_range" | "year_from" | "year_to" | "location"
 * onRemoveTag receives a tag name string
 */
function ActiveFilters({
  q = "",
  yearFrom = "",
  yearTo = "",
  location = "",
  radiusKm = null,
  tags = [],
  onRemove,
  onRemoveTag,
  onClearAll,
}) {
  const chips = [];

  if (q) {
    chips.push({ key: "q", label: `"${q}"` });
  }

  if (yearFrom && yearTo) {
    chips.push({ key: "year_range", label: `${yearFrom}–${yearTo}` });
  } else if (yearFrom) {
    chips.push({ key: "year_from", label: `From ${yearFrom}` });
  } else if (yearTo) {
    chips.push({ key: "year_to", label: `To ${yearTo}` });
  }

  if (location) {
    chips.push({ key: "location", label: `Location: ${location}` });
  }

  if (radiusKm != null) {
    const distanceLabel = radiusKm < 1 ? `${Math.round(radiusKm * 1000)} m` : `${radiusKm} km`;
    chips.push({ key: "proximity", label: `Within ${distanceLabel}` });
  }

  if (chips.length === 0 && tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2" aria-label="Active filters">
      {chips.map((chip) => (
        <FilterChip key={chip.key} label={chip.label} onRemove={() => onRemove(chip.key)} />
      ))}
      {tags.map((tagName) => (
        <TagChip key={tagName} name={tagName} onRemove={() => onRemoveTag(tagName)} />
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-auto py-0.5 px-2 text-sm text-muted-foreground"
        aria-label="Clear all filters"
      >
        Clear all
      </Button>
    </div>
  );
}

export default ActiveFilters;
