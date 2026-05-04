import { useState, useEffect, useCallback } from "react";
import { searchLocationSuggestions } from "@/services/geocodingService";

const DEBOUNCE_MS = 400;
const MIN_CHARS = 3;

/**
 * Debounced location suggestions hook.
 * Fires after 400 ms once the query reaches 3+ characters.
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

    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchLocationSuggestions(query);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const clearSuggestions = useCallback(() => setSuggestions([]), []);

  return { suggestions, isLoading, clearSuggestions };
}
