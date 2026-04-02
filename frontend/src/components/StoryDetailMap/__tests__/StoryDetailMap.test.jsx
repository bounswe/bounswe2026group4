import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, center, zoom, ...props }) => (
    <div data-testid="map-container" data-center={JSON.stringify(center)} data-zoom={zoom} {...props}>
      {children}
    </div>
  ),
  TileLayer: () => null,
  Marker: ({ position }) => (
    <div data-testid="map-marker" data-position={JSON.stringify(position)} />
  ),
}));

vi.mock("leaflet", () => ({
  default: {
    Icon: {
      Default: {
        prototype: { _getIconUrl: vi.fn() },
        mergeOptions: vi.fn(),
      },
    },
  },
}));

import StoryDetailMap from "../StoryDetailMap";

describe("StoryDetailMap", () => {
  it("renders the map container", () => {
    render(<StoryDetailMap lat={41.0082} lng={28.9784} />);
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("centers the map on the provided coordinates", () => {
    render(<StoryDetailMap lat={41.0082} lng={28.9784} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute(
      "data-center",
      JSON.stringify([41.0082, 28.9784])
    );
  });

  it("renders a marker at the provided coordinates", () => {
    render(<StoryDetailMap lat={41.0082} lng={28.9784} />);
    expect(screen.getByTestId("map-marker")).toHaveAttribute(
      "data-position",
      JSON.stringify([41.0082, 28.9784])
    );
  });

  it("uses zoom level 14", () => {
    render(<StoryDetailMap lat={41.0082} lng={28.9784} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-zoom", "14");
  });
});
