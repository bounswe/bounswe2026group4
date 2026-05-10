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
      zoomIn: undefined,
      zoomOut: undefined,
      getZoom: undefined,
      getMinZoom: undefined,
      getMaxZoom: undefined,
      on: undefined,
      off: undefined,
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
  fakeMap.zoomIn = vi.fn();
  fakeMap.zoomOut = vi.fn();
  fakeMap.getZoom = vi.fn(() => 12);
  fakeMap.getMinZoom = vi.fn(() => 3);
  fakeMap.getMaxZoom = vi.fn(() => 18);
  fakeMap.on = vi.fn();
  fakeMap.off = vi.fn();
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

describe("MapView zoom buttons", () => {
  it("renders zoom in and zoom out buttons", () => {
    renderMapView();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
  });

  it("calls map.zoomIn() when the zoom-in button is clicked", async () => {
    const user = userEvent.setup();
    renderMapView();
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(fakeMap.zoomIn).toHaveBeenCalledTimes(1);
  });

  it("calls map.zoomOut() when the zoom-out button is clicked", async () => {
    const user = userEvent.setup();
    renderMapView();
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(fakeMap.zoomOut).toHaveBeenCalledTimes(1);
  });

  it("disables the zoom-in button when at max zoom", () => {
    fakeMap.getZoom = vi.fn(() => 18);
    fakeMap.getMaxZoom = vi.fn(() => 18);
    renderMapView();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom out" })).not.toBeDisabled();
  });

  it("disables the zoom-out button when at min zoom", () => {
    fakeMap.getZoom = vi.fn(() => 3);
    fakeMap.getMinZoom = vi.fn(() => 3);
    renderMapView();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom in" })).not.toBeDisabled();
  });

  it("enables both buttons when between min and max zoom", () => {
    fakeMap.getZoom = vi.fn(() => 12);
    fakeMap.getMinZoom = vi.fn(() => 3);
    fakeMap.getMaxZoom = vi.fn(() => 18);
    renderMapView();
    expect(screen.getByRole("button", { name: "Zoom in" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom out" })).not.toBeDisabled();
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

  it("does not re-fit when re-rendered with the same feature ids", () => {
    const { rerender } = renderMapView({
      featureCollection: makeFeatureCollection([makeFeature(1), makeFeature(2)]),
    });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <MapView
          featureCollection={makeFeatureCollection([makeFeature(1), makeFeature(2)])}
        />
      </MemoryRouter>,
    );
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
  });

  it("re-fits again after the feature set empties and repopulates", () => {
    const { rerender } = renderMapView({
      featureCollection: makeFeatureCollection([makeFeature(1)]),
    });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <MapView featureCollection={makeFeatureCollection([])} />
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter>
        <MapView featureCollection={makeFeatureCollection([makeFeature(1)])} />
      </MemoryRouter>,
    );
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(2);
  });
});

describe("MapView auto-zoom with bbox (geocoded location filter)", () => {
  const BBOX = { latMin: 41.0, latMax: 41.1, lngMin: 28.9, lngMax: 29.0 };

  it("fits to the bbox when bbox is provided and there are zero markers", () => {
    renderMapView({ featureCollection: makeFeatureCollection([]), bbox: BBOX });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    expect(leafletMocks.latLngBounds).toHaveBeenCalledWith([
      [BBOX.latMin, BBOX.lngMin],
      [BBOX.latMax, BBOX.lngMax],
    ]);
    expect(fakeMap.fitBounds.mock.calls[0][1]).toMatchObject({ padding: [40, 40] });
  });

  it("prefers the bbox over marker bounds when both are present", () => {
    renderMapView({
      featureCollection: makeFeatureCollection([makeFeature(1), makeFeature(2)]),
      bbox: BBOX,
    });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    expect(leafletMocks.latLngBounds).toHaveBeenCalledWith([
      [BBOX.latMin, BBOX.lngMin],
      [BBOX.latMax, BBOX.lngMax],
    ]);
  });

  it("falls back to marker bounds when bbox is not provided", () => {
    renderMapView({
      featureCollection: makeFeatureCollection([makeFeature(1), makeFeature(2)]),
      bbox: null,
    });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    expect(fakeMap.fitBounds.mock.calls[0][1]).toMatchObject({ padding: [40, 40] });
  });

  it("does not call fitBounds when neither bbox nor markers are present", () => {
    renderMapView({ featureCollection: makeFeatureCollection([]), bbox: null });
    expect(fakeMap.fitBounds).not.toHaveBeenCalled();
  });

  it("does not re-fit when re-rendered with the same bbox and same marker set", () => {
    const fc = makeFeatureCollection([makeFeature(1), makeFeature(2)]);
    const { rerender } = renderMapView({ featureCollection: fc, bbox: BBOX });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <MapView featureCollection={fc} bbox={{ ...BBOX }} />
      </MemoryRouter>,
    );
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
  });

  it("re-fits when bbox changes even if the marker set is identical", () => {
    const fc = makeFeatureCollection([makeFeature(1)]);
    const { rerender } = renderMapView({ featureCollection: fc, bbox: BBOX });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <MapView
          featureCollection={fc}
          bbox={{ latMin: 40.0, latMax: 40.5, lngMin: 28.0, lngMax: 28.5 }}
        />
      </MemoryRouter>,
    );
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(2);
  });

  it("ignores a partial bbox and uses marker bounds instead", () => {
    renderMapView({
      featureCollection: makeFeatureCollection([makeFeature(1)]),
      bbox: { latMin: 41.0, latMax: 41.1, lngMin: null, lngMax: null },
    });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    expect(fakeMap.fitBounds.mock.calls[0][1]).toMatchObject({ maxZoom: 15 });
  });
});

describe("MapView auto-zoom with proximity (radius filter)", () => {
  const PROXIMITY = { latitude: 41.0, longitude: 28.9, radiusKm: 10 };

  it("fits to a circle around the user when proximity is set and there are zero markers", () => {
    renderMapView({ featureCollection: makeFeatureCollection([]), proximity: PROXIMITY });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    expect(leafletMocks.latLngBounds).toHaveBeenCalledTimes(1);
    const [[swLat, swLng], [neLat, neLng]] = leafletMocks.latLngBounds.mock.calls[0][0];
    // Bounds should be centered on the user with positive lat/lng deltas.
    expect((swLat + neLat) / 2).toBeCloseTo(PROXIMITY.latitude, 5);
    expect((swLng + neLng) / 2).toBeCloseTo(PROXIMITY.longitude, 5);
    expect(neLat).toBeGreaterThan(swLat);
    expect(neLng).toBeGreaterThan(swLng);
  });

  it("prefers the bbox over proximity when both are present", () => {
    const bbox = { latMin: 41.0, latMax: 41.1, lngMin: 28.9, lngMax: 29.0 };
    renderMapView({
      featureCollection: makeFeatureCollection([makeFeature(1)]),
      bbox,
      proximity: PROXIMITY,
    });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    expect(leafletMocks.latLngBounds).toHaveBeenCalledWith([
      [bbox.latMin, bbox.lngMin],
      [bbox.latMax, bbox.lngMax],
    ]);
  });

  it("prefers proximity over marker bounds when bbox is absent", () => {
    renderMapView({
      featureCollection: makeFeatureCollection([makeFeature(1), makeFeature(2)]),
      proximity: PROXIMITY,
    });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    // The bounds passed in must be the user-centered ones, not the marker hull.
    const [[swLat], [neLat]] = leafletMocks.latLngBounds.mock.calls[0][0];
    expect((swLat + neLat) / 2).toBeCloseTo(PROXIMITY.latitude, 5);
  });

  it("does not re-fit when re-rendered with the same proximity and same marker set", () => {
    const fc = makeFeatureCollection([makeFeature(1)]);
    const { rerender } = renderMapView({ featureCollection: fc, proximity: PROXIMITY });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <MapView featureCollection={fc} proximity={{ ...PROXIMITY }} />
      </MemoryRouter>,
    );
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
  });

  it("re-fits when the proximity radius changes", () => {
    const fc = makeFeatureCollection([makeFeature(1)]);
    const { rerender } = renderMapView({ featureCollection: fc, proximity: PROXIMITY });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <MapView featureCollection={fc} proximity={{ ...PROXIMITY, radiusKm: 100 }} />
      </MemoryRouter>,
    );
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(2);
  });

  it("ignores a partial proximity (missing radiusKm) and falls back to marker bounds", () => {
    renderMapView({
      featureCollection: makeFeatureCollection([makeFeature(1)]),
      proximity: { latitude: 41.0, longitude: 28.9, radiusKm: null },
    });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    expect(fakeMap.fitBounds.mock.calls[0][1]).toMatchObject({ maxZoom: 15 });
  });

  it("does not call fitBounds when neither bbox, proximity, nor markers are present", () => {
    renderMapView({ featureCollection: makeFeatureCollection([]), proximity: null });
    expect(fakeMap.fitBounds).not.toHaveBeenCalled();
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

  it("includes a View Timeline link to /timeline with proximity params pre-set", () => {
    // makeFeature(7) → coordinates [28.97, 41.07] (lng, lat per RFC 7946).
    // Coords are rounded via toFixed(6) before the URL is built, so the
    // displayed precision is "41.070000" / "28.970000".
    // Note: featurePopupHtml runs through renderToStaticMarkup, which escapes
    // the `&` query-string separators as `&amp;`. The browser unescapes them
    // when parsing the rendered HTML, so the live href is still `…&…`.
    const html = featurePopupHtml(makeFeature(7));
    expect(html).toContain("View Timeline");
    expect(html).toContain(
      'href="/timeline?latitude=41.070000&amp;longitude=28.970000&amp;radius_km=0.5"',
    );
  });

  it("renders an exact_date story using date_value from feature properties", () => {
    const feature = makeFeature(5, {
      time_type: "exact_date",
      date_value: "1453-05-29",
      year: null,
    });
    const html = featurePopupHtml(feature);
    expect(html).toContain("May 29, 1453");
  });

  it("renders BC dates correctly from feature properties", () => {
    const feature = makeFeature(8, {
      time_type: "exact_year",
      year: -44,
    });
    const html = featurePopupHtml(feature);
    expect(html).toContain("44 BC");
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
          <Route path="/timeline" element={<LocationProbe />} />
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

  it("intercepts clicks on /timeline anchors inside the map and navigates via react-router", async () => {
    const user = userEvent.setup();
    render(<Harness initialEntries={["/map?category=nature"]} />);

    const anchor = document.createElement("a");
    anchor.setAttribute(
      "href",
      "/timeline?latitude=41&longitude=29&radius_km=0.5",
    );
    anchor.textContent = "View Timeline";
    fakeMapContainer.appendChild(anchor);

    await user.click(anchor);

    expect(screen.getByTestId("current-pathname").textContent).toBe("/timeline");
    expect(screen.getByTestId("current-state-from").textContent).toBe(
      "/map?category=nature",
    );
  });

  it("does not intercept anchors whose href starts with '/timeline' but isn't the /timeline?... route", async () => {
    const user = userEvent.setup();
    render(<Harness initialEntries={["/map"]} />);

    // /timelines/... or /timeline-of-events would share the prefix string but
    // are not the proximity-pre-applied route the popup builds.
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "/timelines/123");
    anchor.textContent = "Sibling route";
    // Suppress jsdom's "navigation to another Document" warning — the
    // assertion below is "pathname did not change", and the default
    // navigation would (in jsdom) be a no-op anyway.
    anchor.addEventListener("click", (e) => e.preventDefault());
    fakeMapContainer.appendChild(anchor);

    await user.click(anchor);

    // The interceptor must NOT navigate via react-router for this anchor —
    // pathname stays unchanged.
    expect(screen.getByTestId("current-pathname").textContent).toBe("/map");
  });
});
