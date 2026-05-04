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

    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const result = await geocodeLocation(query);
        setBbox(result);
      } catch {
        setBbox(null);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  return { bbox, isLoading };
}
