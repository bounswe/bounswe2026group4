import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, ...props }) => (
    <div data-testid="map-container" {...props}>{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({ children }) => <div data-testid="map-marker">{children}</div>,
  Popup: ({ children }) => <div data-testid="map-popup">{children}</div>,
  useMap: () => ({ setView: vi.fn() }),
}));

vi.mock("leaflet", () => {
  const L = {
    Icon: { Default: { prototype: { _getIconUrl: "" }, mergeOptions: vi.fn() } },
  };
  return { default: L };
});

import MapView from "../MapView";

function makePin(id, overrides = {}) {
  return {
    id,
    title: `Story ${id}`,
    location_lat: 41.0 + id * 0.01,
    location_lng: 28.9 + id * 0.01,
    location_name: `Location ${id}`,
    time_type: "exact_year",
    year: 1900 + id,
    year_start: null,
    year_end: null,
    ...overrides,
  };
}

function renderMapView(props = {}) {
  return render(
    <BrowserRouter>
      <MapView {...props} />
    </BrowserRouter>
  );
}

describe("MapView", () => {
  it("renders the map container", () => {
    renderMapView();
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("renders markers for each story", () => {
    renderMapView({ stories: [makePin(1), makePin(2), makePin(3)] });
    expect(screen.getAllByTestId("map-marker")).toHaveLength(3);
  });

  it("renders no markers when stories is empty", () => {
    renderMapView({ stories: [] });
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

  it("renders popup content with story title", () => {
    renderMapView({ stories: [makePin(1)] });
    expect(screen.getByText("Story 1")).toBeInTheDocument();
  });

  it("renders popup with location name", () => {
    renderMapView({ stories: [makePin(1)] });
    expect(screen.getByText("Location 1")).toBeInTheDocument();
  });

  it("renders popup with read more link", () => {
    renderMapView({ stories: [makePin(1)] });
    const link = screen.getByRole("link", { name: /read more/i });
    expect(link).toHaveAttribute("href", "/stories/1");
  });

  it("renders popup with time period", () => {
    renderMapView({ stories: [makePin(1, { time_type: "exact_year", year: 1920 })] });
    expect(screen.getByText("1920")).toBeInTheDocument();
  });
});
