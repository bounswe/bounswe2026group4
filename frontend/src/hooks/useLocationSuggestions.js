import { useState, useEffect, useCallback } from "react";
import { searchLocationSuggestions } from "@/services/geocodingService";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

/**
 * Debounced location suggestions hook.
 * Fires after 300 ms once the query reaches 3+ characters.
 * Returns up to 5 Nominatim suggestions, each with an optional bbox.
 */
export function useLocationSuggestions(query) {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query?.trim() || query.trim().length < MIN_CHARS) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchLocationSuggestions(query);
        if (!cancelled) setSuggestions(results);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const clearSuggestions = useCallback(() => setSuggestions([]), []);

  return { suggestions, isLoading, clearSuggestions };
}
