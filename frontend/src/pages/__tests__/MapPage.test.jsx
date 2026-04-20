import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, MemoryRouter } from "react-router-dom";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, ...props }) => (
    <div data-testid="map-container" {...props}>{children}</div>
  ),
  TileLayer: () => null,
  GeoJSON: ({ data }) => {
    const features = data?.features ?? [];
    return (
      <div data-testid="map-geojson" data-feature-count={features.length}>
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
  const L = {
    Icon: { Default: { prototype: { _getIconUrl: "" }, mergeOptions: vi.fn() } },
    marker: vi.fn(() => ({ bindPopup: vi.fn() })),
  };
  return { default: L };
});

vi.mock("@/services/storyService", () => ({
  getMapStories: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

import { getMapStories } from "@/services/storyService";
import MapPage from "../MapPage";

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

function renderPage() {
  return render(
    <BrowserRouter>
      <MapPage />
    </BrowserRouter>,
  );
}

describe("MapPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the map container", async () => {
    getMapStories.mockResolvedValue(makeFeatureCollection([]));
    renderPage();
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("shows loading state while fetching", () => {
    getMapStories.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByLabelText("Loading map pins")).toBeInTheDocument();
  });

  it("renders markers after successful fetch", async () => {
    getMapStories.mockResolvedValue(
      makeFeatureCollection([makeFeature(1), makeFeature(2)]),
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId("map-marker")).toHaveLength(2);
    });
  });

  it("shows error alert when API fails", async () => {
    getMapStories.mockRejectedValue(new Error("Network error"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("retry button refetches after error", async () => {
    const user = userEvent.setup();
    getMapStories
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue(makeFeatureCollection([makeFeature(1)]));

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByTestId("map-marker")).toBeInTheDocument();
    });

    expect(getMapStories).toHaveBeenCalledTimes(2);
  });

  it("shows no markers when API returns an empty FeatureCollection", async () => {
    getMapStories.mockResolvedValue(makeFeatureCollection([]));
    renderPage();

    await waitFor(() => {
      expect(screen.queryByTestId("map-marker")).not.toBeInTheDocument();
    });
  });

  describe("search status indicator", () => {
    function renderPageWithSearch(search = "") {
      return render(
        <MemoryRouter initialEntries={[`/${search}`]}>
          <MapPage />
        </MemoryRouter>,
      );
    }

    it("shows story count when filters are active and results exist", async () => {
      getMapStories.mockResolvedValue({
        ...makeFeatureCollection([makeFeature(1), makeFeature(2)]),
        totalCount: 2,
      });
      render(
        <MemoryRouter initialEntries={["/?q=bridge"]}>
          <MapPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/2 stories found in this area/i)).toBeInTheDocument();
      });
    });

    it("shows singular 'story' when exactly one result exists", async () => {
      getMapStories.mockResolvedValue({
        ...makeFeatureCollection([makeFeature(1)]),
        totalCount: 1,
      });
      render(
        <MemoryRouter initialEntries={["/?q=bridge"]}>
          <MapPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/1 story found in this area/i)).toBeInTheDocument();
      });
    });

    it("shows empty message when filters are active but no results exist", async () => {
      getMapStories.mockResolvedValue({ ...makeFeatureCollection([]), totalCount: 0 });
      render(
        <MemoryRouter initialEntries={["/?q=bridge"]}>
          <MapPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByText(/no stories found with this criteria/i),
        ).toBeInTheDocument();
      });
    });

    it("shows cap notice when totalCount exceeds 100 with q filter", async () => {
      const features = Array.from({ length: 100 }, (_, i) => makeFeature(i + 1));
      getMapStories.mockResolvedValue({
        ...makeFeatureCollection(features),
        totalCount: 150,
      });
      render(
        <MemoryRouter initialEntries={["/?q=bridge"]}>
          <MapPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/showing first 100 results/i)).toBeInTheDocument();
      });
    });

    it("does not show indicator while loading", () => {
      getMapStories.mockReturnValue(new Promise(() => {}));
      render(
        <MemoryRouter initialEntries={["/?q=bridge"]}>
          <MapPage />
        </MemoryRouter>,
      );

      expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
    });

    it("does not show indicator when no filters are active", async () => {
      getMapStories.mockResolvedValue({
        ...makeFeatureCollection([makeFeature(1)]),
        totalCount: 1,
      });
      renderPage();

      await waitFor(() => {
        expect(screen.queryByText(/found in this area/i)).not.toBeInTheDocument();
      });
    });
  });
});
