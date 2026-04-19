import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, ...props }) => (
    <div data-testid="map-container" {...props}>{children}</div>
  ),
  TileLayer: () => null,
  GeoJSON: ({ data, pointToLayer, onEachFeature }) => {
    const features = data?.features ?? [];
    // Invoke the callbacks the same way L.geoJSON would so that bindPopup
    // and marker creation are exercised under test.
    features.forEach((feature) => {
      const fakeLayer = {
        bindPopup: vi.fn(),
        on: vi.fn(),
      };
      pointToLayer?.(feature, [0, 0]);
      onEachFeature?.(feature, fakeLayer);
    });
    return (
      <div
        data-testid="map-geojson"
        data-feature-count={features.length}
      >
        {features.map((f) => (
          <div key={f.id} data-testid="map-marker">
            {f.properties?.title}
          </div>
        ))}
      </div>
    );
  },
  useMap: () => ({ getContainer: () => document.createElement("div") }),
}));

vi.mock("leaflet", () => {
  const marker = vi.fn(() => ({ bindPopup: vi.fn() }));
  const L = {
    Icon: { Default: { prototype: { _getIconUrl: "" }, mergeOptions: vi.fn() } },
    marker,
  };
  return { default: L };
});

import MapView from "../MapView";

function makeFeature(id, overrides = {}) {
  return {
    type: "Feature",
    id,
    geometry: {
      type: "Point",
      coordinates: [28.9 + id * 0.01, 41.0 + id * 0.01],
    },
    properties: {
      title: `Story ${id}`,
      location_name: `Location ${id}`,
      time_type: "exact_year",
      year: 1900 + id,
      year_start: null,
      year_end: null,
      ...overrides,
    },
  };
}

function makeFeatureCollection(features) {
  return { type: "FeatureCollection", features };
}

function renderMapView(props = {}) {
  return render(
    <BrowserRouter>
      <MapView {...props} />
    </BrowserRouter>,
  );
}

describe("MapView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the map container", () => {
    renderMapView();
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("renders a marker for each feature in the FeatureCollection", () => {
    const fc = makeFeatureCollection([makeFeature(1), makeFeature(2), makeFeature(3)]);
    renderMapView({ featureCollection: fc });
    expect(screen.getAllByTestId("map-marker")).toHaveLength(3);
  });

  it("passes the FeatureCollection as-is to the GeoJSON layer", () => {
    const fc = makeFeatureCollection([makeFeature(1)]);
    renderMapView({ featureCollection: fc });
    const layer = screen.getByTestId("map-geojson");
    expect(layer).toHaveAttribute("data-feature-count", "1");
  });

  it("does not render a GeoJSON layer when the FeatureCollection is empty", () => {
    renderMapView({ featureCollection: makeFeatureCollection([]) });
    expect(screen.queryByTestId("map-geojson")).not.toBeInTheDocument();
    expect(screen.queryByTestId("map-marker")).not.toBeInTheDocument();
  });

  it("handles a missing featureCollection prop without crashing", () => {
    renderMapView();
    expect(screen.queryByTestId("map-marker")).not.toBeInTheDocument();
  });

  it("shows loading overlay when loading is true", () => {
    renderMapView({ loading: true });
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading map pins")).toBeInTheDocument();
  });

  it("hides loading overlay when loading is false", () => {
    renderMapView({ loading: false });
    expect(screen.queryByLabelText("Loading map pins")).not.toBeInTheDocument();
  });

  it("exposes the feature title in the marker element", () => {
    const fc = makeFeatureCollection([makeFeature(1)]);
    renderMapView({ featureCollection: fc });
    expect(screen.getByText("Story 1")).toBeInTheDocument();
  });
});
