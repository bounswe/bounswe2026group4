import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// Hoisted reference to the fake Leaflet container so the StoryLinkInterceptor
// in MapView registers its click handler on an element we can dispatch events
// against from tests.
const { fakeMapContainer } = vi.hoisted(() => ({
  fakeMapContainer: document.createElement("div"),
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, ...props }) => (
    <div data-testid="map-container" {...props}>
      <div ref={(el) => el && el.appendChild(fakeMapContainer)} />
      {children}
    </div>
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
  useMap: () => ({ getContainer: () => fakeMapContainer }),
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
import { onEachFeature } from "../mapFeatureUtils";

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

function renderMapView(props = {}, { initialEntries = ["/map"] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <MapView {...props} />
    </MemoryRouter>,
  );
}

describe("MapView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the shared fake container so event listeners from a prior test
    // don't leak into the next one.
    while (fakeMapContainer.firstChild) {
      fakeMapContainer.removeChild(fakeMapContainer.firstChild);
    }
    fakeMapContainer.replaceWith(fakeMapContainer.cloneNode(false));
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

describe("onEachFeature", () => {
  it("binds a popup whose HTML contains title, location, time period, and a Read more link", () => {
    const feature = makeFeature(42, {
      title: "The Old Bridge",
      location_name: "Galata",
      year: 1920,
    });
    const bindPopup = vi.fn();
    onEachFeature(feature, { bindPopup });

    expect(bindPopup).toHaveBeenCalledTimes(1);
    const html = bindPopup.mock.calls[0][0];
    expect(html).toContain("The Old Bridge");
    expect(html).toContain("Galata");
    expect(html).toContain("1920");
    expect(html).toContain("Read more");
    expect(html).toContain('href="/stories/42"');
  });

  it("omits the location line when location_name is missing", () => {
    const feature = makeFeature(7, { location_name: undefined });
    const bindPopup = vi.fn();
    onEachFeature(feature, { bindPopup });

    const html = bindPopup.mock.calls[0][0];
    expect(html).toContain("Story 7");
    expect(html).not.toContain("Location 7");
  });
});

describe("StoryLinkInterceptor", () => {
  function LocationProbe() {
    const loc = useLocation();
    return (
      <>
        <div data-testid="current-pathname">{loc.pathname}</div>
        <div data-testid="current-state-from">{loc.state?.from ?? ""}</div>
      </>
    );
  }

  function Harness({ initialEntries }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route
            path="/map"
            element={
              <>
                <MapView featureCollection={makeFeatureCollection([makeFeature(99)])} />
                <LocationProbe />
              </>
            }
          />
          <Route path="/stories/:id" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("intercepts clicks on /stories/ anchors inside the map and navigates via react-router", async () => {
    const user = userEvent.setup();
    render(<Harness initialEntries={["/map?category=nature"]} />);

    // Simulate the popup HTML Leaflet would have injected into the map container.
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "/stories/99");
    anchor.textContent = "Read more";
    fakeMapContainer.appendChild(anchor);

    expect(screen.getByTestId("current-pathname").textContent).toBe("/map");

    await user.click(anchor);

    expect(screen.getByTestId("current-pathname").textContent).toBe("/stories/99");
    // Filter state must survive the SPA navigation so the Back navigation
    // returns the user to the filtered map.
    expect(screen.getByTestId("current-state-from").textContent).toBe(
      "/map?category=nature",
    );
  });
});
