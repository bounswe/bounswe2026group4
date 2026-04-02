import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";

/**
 * Controlled search input with debounced URL updates.
 * Shows the typed value instantly; calls onSearch after 300 ms of inactivity.
 */
function SearchBar({
  defaultValue = "",
  onSearch,
  placeholder = "Search stories by title or location\u2026",
}) {
  const [value, setValue] = useState(defaultValue);
  const isFirstRender = useRef(true);
  const debouncedValue = useDebounce(value, 300);

  // Sync local state when external value changes (e.g. "Clear all filters")
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  // Trigger search after debounce delay, but not on initial mount
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onSearch(debouncedValue);
    // onSearch is stable (useCallback in parent); debouncedValue drives re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  function handleClear() {
    setValue("");
    onSearch("");
  }

  return (
    <div className="relative flex items-center w-full">
      <Search
        className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
        aria-label="Search stories"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 h-7 w-7 p-0"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

export default SearchBar;
