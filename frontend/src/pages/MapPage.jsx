import { useState, useEffect, useCallback } from "react";

import MapView from "@/components/MapView/MapView";
import SearchFilter from "@/components/SearchFilter/SearchFilter";
import { getMapStories } from "@/services/storyService";
import { useFilterState } from "@/hooks/useFilterState";

const EMPTY_FEATURE_COLLECTION = { type: "FeatureCollection", features: [] };

function MapPage() {
  const { q, yearFrom, yearTo, location } = useFilterState();

  const [featureCollection, setFeatureCollection] = useState(EMPTY_FEATURE_COLLECTION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMapStories({ q, yearFrom, yearTo, location });
      setFeatureCollection(data ?? EMPTY_FEATURE_COLLECTION);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load map pins. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [q, yearFrom, yearTo, location]);

  useEffect(() => {
    fetchPins();
  }, [fetchPins]);

  return (
    <div className="relative isolate" style={{ height: "calc(100vh - 3.5rem)" }}>
      <MapView featureCollection={featureCollection} loading={loading} />

      {/* Search & filter overlay */}
      <div className="absolute top-3 left-3 right-3 z-[1000] sm:left-4 sm:right-auto sm:w-[32rem]">
        <div className="rounded-lg border bg-background/95 p-3 shadow-md backdrop-blur-sm">
          <SearchFilter />
        </div>
      </div>

      {error && (
        <div
          className="absolute bottom-4 left-1/2 z-[1001] -translate-x-1/2 rounded-md bg-destructive/90 px-4 py-2 text-sm text-destructive-foreground shadow-md"
          role="alert"
        >
          {error}
          <button className="ml-3 underline font-medium" onClick={fetchPins}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export default MapPage;
