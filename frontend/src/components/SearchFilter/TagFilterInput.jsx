import { useState, useEffect, useRef } from "react";
import { X, Search, Tag } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { searchTags } from "@/services/tagService";
import { getTagColorClass } from "@/utils/tagUtils";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Tag autocomplete input for the filter panel.
 * Selects existing tags only (no create). Works with arrays of tag name strings.
 */
function TagFilterInput({ value = [], onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const containerRef = useRef(null);
  const debouncedInput = useDebounce(inputValue, 300);

  const selectedNames = new Set(value);
  const filteredSuggestions = suggestions.filter((t) => !selectedNames.has(t.name));

  function closeDropdown() {
    setIsOpen(false);
    setInputValue("");
  }

  useEffect(() => {
    if (!isOpen) return;
    searchTags(debouncedInput)
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }, [isOpen, debouncedInput]);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  function addTag(name) {
    if (selectedNames.has(name)) return;
    onChange([...value, name]);
    setInputValue("");
  }

  function removeTag(name) {
    onChange(value.filter((t) => t !== name));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredSuggestions.length > 0) addTag(filteredSuggestions[0].name);
    } else if (e.key === "Escape") {
      closeDropdown();
    }
  }

  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium">Tags</Label>
      <div ref={containerRef} className="space-y-2">
        {value.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Selected tag filters">
            {value.map((name) => (
              <span
                key={name}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  getTagColorClass(name)
                )}
              >
                {name}
                <button
                  type="button"
                  onClick={() => removeTag(name)}
                  aria-label={`Remove tag ${name}`}
                  className="rounded-full hover:opacity-70"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          aria-expanded={isOpen}
          aria-label="Add tag filter"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/50 px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <Tag className="h-3 w-3" aria-hidden="true" />
          Add tag
        </button>

        {isOpen && (
          <div className="rounded-md border bg-popover shadow-sm">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search tags…"
                autoFocus
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                aria-label="Tag filter search"
              />
            </div>
            <ul role="listbox" aria-label="Tag suggestions" className="max-h-40 overflow-y-auto p-1">
              {filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((tag) => (
                  <li
                    key={tag.id ?? tag.name}
                    role="option"
                    aria-selected="false"
                    className="flex cursor-pointer items-center justify-between rounded-sm px-3 py-1.5 hover:bg-accent"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addTag(tag.name);
                    }}
                  >
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        getTagColorClass(tag.name)
                      )}
                    >
                      {tag.name}
                    </span>
                    {tag.story_count !== undefined && (
                      <span className="text-xs text-muted-foreground">{tag.story_count}</span>
                    )}
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm text-muted-foreground">No tags found</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default TagFilterInput;
