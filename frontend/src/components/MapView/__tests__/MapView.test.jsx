import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const { fakeMapContainer, fakeMap, leafletMocks } = vi.hoisted(() => {
  const container = document.createElement("div");
  return {
    fakeMapContainer: container,
    fakeMap: {
      fitBounds: undefined,
      addLayer: undefined,
      removeLayer: undefined,
      getContainer: () => container,
    },
    leafletMocks: {
      marker: undefined,
      markerClusterGroup: undefined,
      latLngBounds: undefined,
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
  useMap: () => fakeMap,
}));

vi.mock("leaflet", () => {
  const marker = vi.fn((latlng) => ({ bindPopup: vi.fn(), latlng }));
  const latLngBounds = vi.fn((latlngs) => ({ latlngs }));
  const markerClusterGroup = vi.fn(() => ({
    addLayer: vi.fn(),
    addLayers: vi.fn(),
    clearLayers: vi.fn(),
    removeLayer: vi.fn(),
  }));
  leafletMocks.marker = marker;
  leafletMocks.markerClusterGroup = markerClusterGroup;
  leafletMocks.latLngBounds = latLngBounds;
  const L = {
    Icon: { Default: { prototype: { _getIconUrl: "" }, mergeOptions: vi.fn() } },
    marker,
    markerClusterGroup,
    latLngBounds,
  };
  return { default: L };
});

import MapView from "../MapView";
import { featurePopupHtml } from "../mapFeatureUtils";

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

describe("MapView", () => {
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

  it("binds a popup whose lazy callback returns HTML containing the feature title", () => {
    renderMapView({
      featureCollection: makeFeatureCollection([
        makeFeature(1, { title: "Castle Story" }),
      ]),
    });
    const markerInstance = leafletMocks.marker.mock.results[0].value;
    expect(markerInstance.bindPopup).toHaveBeenCalledTimes(1);
    const popupArg = markerInstance.bindPopup.mock.calls[0][0];
    expect(typeof popupArg).toBe("function");
    expect(popupArg()).toContain("Castle Story");
  });
});

describe("featurePopupHtml", () => {
  it("returns HTML containing title, location, time period, and a Read more link", () => {
    const feature = makeFeature(42, {
      title: "The Old Bridge",
      location_name: "Galata",
      year: 1920,
    });
    const html = featurePopupHtml(feature);
    expect(html).toContain("The Old Bridge");
    expect(html).toContain("Galata");
    expect(html).toContain("1920");
    expect(html).toContain("Read more");
    expect(html).toContain('href="/stories/42"');
  });

  it("omits the location line when location_name is missing", () => {
    const feature = makeFeature(7, { location_name: undefined });
    const html = featurePopupHtml(feature);
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

    const anchor = document.createElement("a");
    anchor.setAttribute("href", "/stories/99");
    anchor.textContent = "Read more";
    fakeMapContainer.appendChild(anchor);

    expect(screen.getByTestId("current-pathname").textContent).toBe("/map");

    await user.click(anchor);

    expect(screen.getByTestId("current-pathname").textContent).toBe("/stories/99");
    // Filter state must survive the SPA navigation so Back returns the user
    // to the filtered map.
    expect(screen.getByTestId("current-state-from").textContent).toBe(
      "/map?category=nature",
    );
  });
});
