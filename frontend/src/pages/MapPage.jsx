import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { List, Map, Plus, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import MapView from "@/components/MapView/MapView";
import { getMapPins } from "@/services/storyService";

function MapPage() {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMapPins();
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
    <main className="flex h-screen flex-col bg-background">
      {/* Top nav bar */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 border-b">
        <h1 className="text-xl font-bold tracking-tight">Map View</h1>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div
            className="flex rounded-md border border-input overflow-hidden"
            role="group"
            aria-label="View toggle"
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label="Feed view"
              aria-pressed="false"
              className="rounded-none border-r border-input h-9 w-9"
              onClick={() => navigate("/feed")}
            >
              <List aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Map view"
              aria-pressed="true"
              className="rounded-none h-9 w-9 bg-accent"
            >
              <Map aria-hidden="true" />
            </Button>
          </div>

          <Button
            size="icon"
            aria-label="Add story"
            onClick={() => navigate("/stories/new")}
          >
            <Plus aria-hidden="true" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            aria-label="Profile"
            onClick={() => navigate("/profile")}
          >
            <User aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Map area */}
      <div className="relative flex-1">
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
    </main>
  );
}

export default MapPage;
