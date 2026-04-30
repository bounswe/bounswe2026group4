import { useState, useEffect, useRef } from "react";
import { X, Plus, Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { searchTags, createOrGetTag } from "@/services/tagService";
import { toSlug, getTagColorClass } from "@/utils/tagUtils";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";

const MAX_TAGS = 3;

function TagInput({ value = [], onChange, disabled }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [rawSuggestions, setRawSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef(null);
  const debouncedInput = useDebounce(inputValue, 300);

  const selectedNames = new Set(value.map((t) => t.name));
  const suggestions = rawSuggestions.filter((t) => !selectedNames.has(t.name));
  const slug = toSlug(inputValue);
  const isExactMatch = suggestions.some((s) => s.name === slug);
  const showCreate = Boolean(slug) && !isExactMatch && !isLoading;

  // Reset input when panel closes
  useEffect(() => {
    if (!isOpen) setInputValue("");
  }, [isOpen]);

  // Fetch tags whenever the panel is open and the debounced search changes
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    searchTags(debouncedInput)
      .then(setRawSuggestions)
      .catch(() => setRawSuggestions([]))
      .finally(() => setIsLoading(false));
  }, [isOpen, debouncedInput]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  function addTag(tag) {
    if (value.length >= MAX_TAGS || selectedNames.has(tag.name)) return;
    const next = [...value, tag];
    onChange(next);
    if (next.length >= MAX_TAGS) setIsOpen(false);
  }

  async function handleCreate() {
    const s = toSlug(inputValue);
    if (!s || value.length >= MAX_TAGS || selectedNames.has(s)) return;
    setIsCreating(true);
    try {
      const tag = await createOrGetTag(s);
      const next = [...value, tag];
      onChange(next);
      setInputValue("");
      if (next.length >= MAX_TAGS) setIsOpen(false);
    } catch {
      toast.error("Failed to create tag. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  function removeTag(tag) {
    onChange(value.filter((t) => t.name !== tag.name));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (slug && !isExactMatch) {
        handleCreate();
      } else if (suggestions.length > 0) {
        addTag(suggestions[0]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Selected chips + Add button */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
        {value.map((tag) => (
          <span
            key={tag.name}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
              getTagColorClass(tag.name)
            )}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag.name}`}
              disabled={disabled}
              className="rounded-full hover:opacity-70"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}

        {value.length < MAX_TAGS && !disabled && (
          <button
            type="button"
            onClick={() => setIsOpen((o) => !o)}
            aria-expanded={isOpen}
            aria-label="Add tag"
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/50 px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Add tag
          </button>
        )}
      </div>

      {/* Tag selection panel */}
      {isOpen && !disabled && (
        <div className="rounded-md border bg-popover shadow-sm">
          {/* Search row */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search tags…"
              disabled={isCreating}
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
              aria-label="Tag search input"
            />
          </div>

          {/* Scrollable tag list */}
          <ul role="listbox" className="max-h-48 overflow-y-auto p-1">
            {isLoading ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Loading…</li>
            ) : (
              <>
                {suggestions.map((tag) => (
                  <li
                    key={tag.id}
                    role="option"
                    aria-selected="false"
                    className="flex cursor-pointer items-center justify-between rounded-sm px-3 py-1.5 hover:bg-accent"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addTag(tag);
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
                    <span className="text-xs text-muted-foreground">{tag.story_count}</span>
                  </li>
                ))}

                {!isLoading && suggestions.length === 0 && !showCreate && (
                  <li className="px-3 py-2 text-sm text-muted-foreground">No tags found</li>
                )}

                {showCreate && (
                  <li
                    role="option"
                    aria-selected="false"
                    data-testid="create-option"
                    className="cursor-pointer rounded-sm px-3 py-1.5 text-sm text-primary hover:bg-accent"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleCreate();
                    }}
                  >
                    Create &ldquo;{slug}&rdquo;
                  </li>
                )}
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default TagInput;
