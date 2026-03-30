import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("@/services/storyService", () => ({
  getMapPins: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import { getMapPins } from "@/services/storyService";
import MapPage from "../MapPage";

function makePin(id, overrides = {}) {
  return {
    id,
    title: `Story ${id}`,
    latitude: 41.0 + id * 0.01,
    longitude: 28.9 + id * 0.01,
    location_name: `Location ${id}`,
    time_type: "exact_year",
    year: 1900 + id,
    year_start: null,
    year_end: null,
    preview_text: "A short preview about local history.",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <BrowserRouter>
      <MapPage />
    </BrowserRouter>
  );
}

describe("MapPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  it("renders the map container", async () => {
    getMapPins.mockResolvedValue([]);
    renderPage();
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("shows loading state while fetching", () => {
    getMapPins.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByLabelText("Loading map pins")).toBeInTheDocument();
  });

  it("renders markers after successful fetch", async () => {
    getMapPins.mockResolvedValue([makePin(1), makePin(2)]);
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId("map-marker")).toHaveLength(2);
    });
  });

  it("shows error alert when API fails", async () => {
    getMapPins.mockRejectedValue(new Error("Network error"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("retry button refetches after error", async () => {
    const user = userEvent.setup();
    getMapPins
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue([makePin(1)]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByTestId("map-marker")).toBeInTheDocument();
    });

    expect(getMapPins).toHaveBeenCalledTimes(2);
  });

  it("renders page heading", () => {
    getMapPins.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("heading", { name: /map view/i })).toBeInTheDocument();
  });

  it("feed view button navigates to /feed", async () => {
    const user = userEvent.setup();
    getMapPins.mockResolvedValue([]);
    renderPage();

    await user.click(screen.getByRole("button", { name: /feed view/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/feed");
  });

  it("map view button is marked active", () => {
    getMapPins.mockReturnValue(new Promise(() => {}));
    renderPage();

    const mapBtn = screen.getByRole("button", { name: /map view/i });
    expect(mapBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("feed view button is not marked active", () => {
    getMapPins.mockReturnValue(new Promise(() => {}));
    renderPage();

    const feedBtn = screen.getByRole("button", { name: /feed view/i });
    expect(feedBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("shows no markers when API returns empty array", async () => {
    getMapPins.mockResolvedValue([]);
    renderPage();

    await waitFor(() => {
      expect(screen.queryByTestId("map-marker")).not.toBeInTheDocument();
    });
  });
});
