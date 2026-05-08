import { useState, useEffect, useCallback, useRef } from "react";
import { searchLocationSuggestions } from "@/services/geocodingService";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

/**
 * Debounced location suggestions hook.
 * Fires after 300 ms once the query reaches 3+ characters.
 * Returns up to 5 Nominatim suggestions, each with a bbox.
 *
 * `hasSearched` flips true only when a search has actually completed for the
 * current query — used by callers to distinguish "haven't searched yet" from
 * "searched and got nothing" (so they can suppress a "no results" hint while
 * a debounce is pending or after the list is dismissed programmatically).
 *
 * `cancel(suppressQuery)` stops any pending debounce, clears the list, and
 * (when given a query) makes the hook skip the next search for that exact
 * query. Used on suggestion select so writing the chosen title back into the
 * input doesn't immediately re-fetch and reopen the dropdown.
 */
export function useLocationSuggestions(query) {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const timerRef = useRef(null);
  // Bumped on every effect run AND on cancel(). Each timer captures its own
  // version and only commits state if the current version still matches —
  // protects against stale results from cancelled or superseded searches.
  const versionRef = useRef(0);
  const suppressedQueryRef = useRef(null);

  useEffect(() => {
    const trimmed = query?.trim();
    if (!trimmed || trimmed.length < MIN_CHARS) {
      versionRef.current += 1;
      setSuggestions([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    if (suppressedQueryRef.current === query) {
      suppressedQueryRef.current = null;
      return;
    }

    versionRef.current += 1;
    const myVersion = versionRef.current;
    setIsLoading(true);
    setHasSearched(false);

    const timer = setTimeout(async () => {
      try {
        const results = await searchLocationSuggestions(query);
        if (versionRef.current === myVersion) {
          setSuggestions(results);
          setHasSearched(true);
        }
      } catch {
        if (versionRef.current === myVersion) {
          setSuggestions([]);
          setHasSearched(true);
        }
      } finally {
        if (versionRef.current === myVersion) setIsLoading(false);
      }
    }, DEBOUNCE_MS);
    timerRef.current = timer;

    return () => clearTimeout(timer);
  }, [query]);

  const cancel = useCallback((suppressQuery) => {
    versionRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setSuggestions([]);
    setIsLoading(false);
    setHasSearched(false);
    if (suppressQuery !== undefined) {
      suppressedQueryRef.current = suppressQuery;
    }
  }, []);

  // Back-compat alias for callers that just want to dismiss the list (no
  // suppression of the next query). Kept so FilterPanel doesn't have to change
  // — it owns its own input lifecycle and is being touched by another PR.
  const clearSuggestions = useCallback(() => cancel(), [cancel]);

  return { suggestions, isLoading, hasSearched, cancel, clearSuggestions };
}
