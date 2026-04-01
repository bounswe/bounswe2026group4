import { useState, useEffect, useCallback } from "react";

import MapView from "@/components/MapView/MapView";
import { getMapStories } from "@/services/storyService";

function MapPage() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMapStories();
      setStories(data);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load map pins. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPins();
  }, [fetchPins]);

  return (
    <div className="relative" style={{ height: "calc(100vh - 3.5rem)" }}>
      <MapView stories={stories} loading={loading} />
      {error && (
        <div
          className="absolute top-4 left-1/2 z-[1001] -translate-x-1/2 rounded-md bg-destructive/90 px-4 py-2 text-sm text-destructive-foreground shadow-md"
          role="alert"
        >
          {error}
          <button
            className="ml-3 underline font-medium"
            onClick={fetchPins}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export default MapPage;
