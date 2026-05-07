import { useState, useEffect } from "react";
import { geocodeLocation } from "@/services/geocodingService";

const DEBOUNCE_MS = 600;

/**
 * Debounced geocoding hook. Fires a Nominatim request 600 ms after the query
 * stops changing and returns the resolved bounding box (or null on no result).
 */
export function useGeocoding(query) {
  const [bbox, setBbox] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query?.trim()) {
      setBbox(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const result = await geocodeLocation(query);
        if (!cancelled) setBbox(result);
      } catch {
        if (!cancelled) setBbox(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  return { bbox, isLoading };
}
