import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// Hoisted references shared between the test file and the mocked modules.
// fakeMapContainer is the DOM node StoryLinkInterceptor binds its click
// handler on. fakeMap exposes the leaflet methods MapView's child components
// invoke (fitBounds / addLayer / removeLayer) so tests can assert call args.
const { fakeMapContainer, fakeMap, leafletMocks } = vi.hoisted(() => {
  const container = document.createElement("div");
  const map = {
    fitBounds: undefined,
    addLayer: undefined,
    removeLayer: undefined,
    getContainer: () => container,
  };
  return {
    fakeMapContainer: container,
    fakeMap: map,
    leafletMocks: {
      marker: undefined,
      markerClusterGroup: undefined,
      featureGroup: undefined,
      latLngBounds: undefined,
      latLng: undefined,
    },
  };
});

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
  useMap: () => fakeMap,
}));

vi.mock("leaflet", () => {
  const marker = vi.fn((latlng) => {
    const layer = { bindPopup: vi.fn(), latlng };
    return layer;
  });
  const featureGroup = vi.fn((markers) => ({
    getBounds: () => ({ markers, kind: "feature-group-bounds" }),
  }));
  const latLngBounds = vi.fn((latlngs) => ({
    latlngs,
    kind: "latlng-bounds",
  }));
  const latLng = vi.fn((lat, lng) => ({ lat, lng }));
  const markerClusterGroup = vi.fn(() => ({
    addLayer: vi.fn(),
    addLayers: vi.fn(),
    clearLayers: vi.fn(),
    removeLayer: vi.fn(),
    kind: "cluster-group",
  }));
  leafletMocks.marker = marker;
  leafletMocks.markerClusterGroup = markerClusterGroup;
  leafletMocks.featureGroup = featureGroup;
  leafletMocks.latLngBounds = latLngBounds;
  leafletMocks.latLng = latLng;
  const L = {
    Icon: { Default: { prototype: { _getIconUrl: "" }, mergeOptions: vi.fn() } },
    marker,
    markerClusterGroup,
    featureGroup,
    latLngBounds,
    latLng,
  };
  return { default: L };
});

vi.mock("leaflet.markercluster", () => ({}));
vi.mock("leaflet.markercluster/dist/MarkerCluster.css", () => ({}));
vi.mock("leaflet.markercluster/dist/MarkerCluster.Default.css", () => ({}));

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
    fakeMap.fitBounds = vi.fn();
    fakeMap.addLayer = vi.fn();
    fakeMap.removeLayer = vi.fn();
    fakeMap.getContainer = () => fakeMapContainer;
  });

  it("renders the map container", () => {
    renderMapView();
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("creates a leaflet marker for each feature in the FeatureCollection", () => {
    const fc = makeFeatureCollection([makeFeature(1), makeFeature(2), makeFeature(3)]);
    renderMapView({ featureCollection: fc });
    expect(leafletMocks.marker).toHaveBeenCalledTimes(3);
  });

  it("creates markers using [lat, lng] order from feature [lng, lat] coordinates", () => {
    const fc = makeFeatureCollection([makeFeature(1)]);
    renderMapView({ featureCollection: fc });
    // makeFeature(1).geometry.coordinates = [28.91, 41.01]
    const firstCallArg = leafletMocks.marker.mock.calls[0][0];
    expect(firstCallArg[0]).toBeCloseTo(41.01);
    expect(firstCallArg[1]).toBeCloseTo(28.91);
  });

  it("does not create any markers when the FeatureCollection is empty", () => {
    renderMapView({ featureCollection: makeFeatureCollection([]) });
    expect(leafletMocks.marker).not.toHaveBeenCalled();
  });

  it("handles a missing featureCollection prop without crashing", () => {
    renderMapView();
    expect(leafletMocks.marker).not.toHaveBeenCalled();
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
});

describe("MapView auto-zoom (fit bounds)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    while (fakeMapContainer.firstChild) {
      fakeMapContainer.removeChild(fakeMapContainer.firstChild);
    }
    fakeMapContainer.replaceWith(fakeMapContainer.cloneNode(false));
    fakeMap.fitBounds = vi.fn();
    fakeMap.addLayer = vi.fn();
    fakeMap.removeLayer = vi.fn();
    fakeMap.getContainer = () => fakeMapContainer;
  });

  it("does not call fitBounds when there are zero features", () => {
    renderMapView({ featureCollection: makeFeatureCollection([]) });
    expect(fakeMap.fitBounds).not.toHaveBeenCalled();
  });

  it("calls fitBounds with maxZoom 15 when there is exactly one feature", () => {
    renderMapView({ featureCollection: makeFeatureCollection([makeFeature(1)]) });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    const options = fakeMap.fitBounds.mock.calls[0][1];
    expect(options).toMatchObject({ maxZoom: 15 });
  });

  it("calls fitBounds with bounds covering all features when there are multiple", () => {
    const fc = makeFeatureCollection([
      makeFeature(1),
      makeFeature(2),
      makeFeature(3),
    ]);
    renderMapView({ featureCollection: fc });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    const options = fakeMap.fitBounds.mock.calls[0][1];
    expect(options).toMatchObject({ padding: [40, 40] });
  });

  it("re-fits bounds when the feature set changes", () => {
    const { rerender } = renderMapView({
      featureCollection: makeFeatureCollection([makeFeature(1)]),
    });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <MapView
          featureCollection={makeFeatureCollection([makeFeature(2), makeFeature(3)])}
        />
      </MemoryRouter>,
    );
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(2);
  });
});

describe("MapView pin clustering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    while (fakeMapContainer.firstChild) {
      fakeMapContainer.removeChild(fakeMapContainer.firstChild);
    }
    fakeMapContainer.replaceWith(fakeMapContainer.cloneNode(false));
    fakeMap.fitBounds = vi.fn();
    fakeMap.addLayer = vi.fn();
    fakeMap.removeLayer = vi.fn();
    fakeMap.getContainer = () => fakeMapContainer;
  });

  it("creates a marker cluster group when features are present", () => {
    renderMapView({ featureCollection: makeFeatureCollection([makeFeature(1)]) });
    expect(leafletMocks.markerClusterGroup).toHaveBeenCalled();
  });

  it("adds the cluster group to the map", () => {
    renderMapView({ featureCollection: makeFeatureCollection([makeFeature(1)]) });
    const clusterGroup = leafletMocks.markerClusterGroup.mock.results[0].value;
    expect(fakeMap.addLayer).toHaveBeenCalledWith(clusterGroup);
  });

  it("clears and repopulates the cluster group when features change", () => {
    const { rerender } = renderMapView({
      featureCollection: makeFeatureCollection([makeFeature(1)]),
    });
    const clusterGroup = leafletMocks.markerClusterGroup.mock.results[0].value;
    const initialMarkerCalls = leafletMocks.marker.mock.calls.length;

    rerender(
      <MemoryRouter>
        <MapView
          featureCollection={makeFeatureCollection([makeFeature(2), makeFeature(3)])}
        />
      </MemoryRouter>,
    );

    expect(clusterGroup.clearLayers).toHaveBeenCalled();
    expect(leafletMocks.marker.mock.calls.length).toBeGreaterThan(initialMarkerCalls);
  });

  it("removes the cluster group from the map on unmount", () => {
    const { unmount } = renderMapView({
      featureCollection: makeFeatureCollection([makeFeature(1)]),
    });
    const clusterGroup = leafletMocks.markerClusterGroup.mock.results[0].value;
    unmount();
    expect(fakeMap.removeLayer).toHaveBeenCalledWith(clusterGroup);
  });

  it("binds a popup containing the feature title for each marker", () => {
    renderMapView({
      featureCollection: makeFeatureCollection([
        makeFeature(1, { title: "Castle Story" }),
      ]),
    });
    const markerInstance = leafletMocks.marker.mock.results[0].value;
    expect(markerInstance.bindPopup).toHaveBeenCalledTimes(1);
    const html = markerInstance.bindPopup.mock.calls[0][0];
    expect(html).toContain("Castle Story");
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
