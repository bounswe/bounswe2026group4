import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, ...props }) => (
    <div data-testid="map-container" {...props}>
      {children}
    </div>
  ),
  TileLayer: () => null,
  Marker: ({ children, ...props }) => (
    <div data-testid="map-marker" {...props}>
      {children}
    </div>
  ),
  useMapEvents: () => null,
  useMap: () => ({ setView: vi.fn() }),
}));

import MapPicker from "../MapPicker";

describe("MapPicker", () => {
  it("renders the map container", () => {
    render(<MapPicker value={null} onChange={vi.fn()} />);
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("does not show marker when value is null", () => {
    render(<MapPicker value={null} onChange={vi.fn()} />);
    expect(screen.queryByTestId("map-marker")).not.toBeInTheDocument();
  });

  it("shows marker when value is provided", () => {
    render(
      <MapPicker value={{ lat: 41.0, lng: 29.0 }} onChange={vi.fn()} />
    );
    expect(screen.getByTestId("map-marker")).toBeInTheDocument();
  });

  it("displays coordinates when value is provided", () => {
    render(
      <MapPicker value={{ lat: 41.0082, lng: 28.9784 }} onChange={vi.fn()} />
    );
    expect(screen.getByText(/41\.0082/)).toBeInTheDocument();
    expect(screen.getByText(/28\.9784/)).toBeInTheDocument();
  });

  it("shows instruction text when no location selected", () => {
    render(<MapPicker value={null} onChange={vi.fn()} />);
    expect(
      screen.getByText(/click on the map to select a location/i)
    ).toBeInTheDocument();
  });
});
