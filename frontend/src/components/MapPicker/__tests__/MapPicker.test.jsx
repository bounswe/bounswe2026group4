import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

const { fakeMap, mapEventHandlers } = vi.hoisted(() => ({
  fakeMap: { setView: vi.fn() },
  mapEventHandlers: {},
}));

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
  useMapEvents: (handlers) => {
    Object.assign(mapEventHandlers, handlers);
    return null;
  },
  useMap: () => fakeMap,
}));

vi.mock("@/services/geocodingService", () => ({
  searchLocationSuggestions: vi.fn(),
}));

import MapPicker from "../MapPicker";
import { searchLocationSuggestions } from "@/services/geocodingService";

const ISTANBUL_BBOX = {
  latMin: 41.0,
  latMax: 41.1,
  lngMin: 28.9,
  lngMax: 29.0,
};
// Centre of ISTANBUL_BBOX — what selectSuggestion should emit.
const ISTANBUL_CENTER = { lat: 41.05, lng: 28.95 };

function searchInput() {
  return screen.getByLabelText("Search for a location");
}

function setQuery(value) {
  fireEvent.change(searchInput(), { target: { value } });
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  fakeMap.setView.mockClear();
  for (const k of Object.keys(mapEventHandlers)) delete mapEventHandlers[k];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MapPicker — base behaviour", () => {
  it("renders the map container", () => {
    render(<MapPicker value={null} onChange={vi.fn()} />);
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("does not show marker when value is null", () => {
    render(<MapPicker value={null} onChange={vi.fn()} />);
    expect(screen.queryByTestId("map-marker")).not.toBeInTheDocument();
  });

  it("shows marker when value is provided", () => {
    render(<MapPicker value={{ lat: 41.0, lng: 29.0 }} onChange={vi.fn()} />);
    expect(screen.getByTestId("map-marker")).toBeInTheDocument();
  });

  it("displays coordinates when value is provided", () => {
    render(<MapPicker value={{ lat: 41.0082, lng: 28.9784 }} onChange={vi.fn()} />);
    expect(screen.getByText(/41\.0082/)).toBeInTheDocument();
    expect(screen.getByText(/28\.9784/)).toBeInTheDocument();
  });

  it("shows instruction text when no location selected", () => {
    render(<MapPicker value={null} onChange={vi.fn()} />);
    expect(
      screen.getByText(/search above or click on the map to select a location/i)
    ).toBeInTheDocument();
  });

  it("calls onChange when the map is clicked (manual pin drop)", () => {
    const onChange = vi.fn();
    render(<MapPicker value={null} onChange={onChange} />);
    mapEventHandlers.click({ latlng: { lat: 41.0, lng: 29.0 } });
    expect(onChange).toHaveBeenCalledWith({ lat: 41.0, lng: 29.0 });
  });
});

describe("MapPicker — location search & autocomplete", () => {
  it("does not call the suggestions service for queries shorter than 3 chars", async () => {
    vi.useFakeTimers();
    render(<MapPicker value={null} onChange={vi.fn()} />);

    setQuery("Is");
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(searchLocationSuggestions).not.toHaveBeenCalled();
  });

  it("debounces the suggestions request (no fetch within 300ms)", async () => {
    vi.useFakeTimers();
    searchLocationSuggestions.mockResolvedValue([]);
    render(<MapPicker value={null} onChange={vi.fn()} />);

    setQuery("Ista");

    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(searchLocationSuggestions).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(searchLocationSuggestions).toHaveBeenCalledTimes(1);
    expect(searchLocationSuggestions).toHaveBeenCalledWith("Ista");
  });

  it("renders suggestions after the debounce window", async () => {
    vi.useFakeTimers();
    searchLocationSuggestions.mockResolvedValue([
      { id: "1", title: "Istanbul", subtitle: "Türkiye", bbox: ISTANBUL_BBOX },
    ]);
    render(<MapPicker value={null} onChange={vi.fn()} />);

    setQuery("Istanbul");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flushPromises();

    expect(
      screen.getByRole("listbox", { name: /location suggestions/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Istanbul")).toBeInTheDocument();
    expect(screen.getByText("Türkiye")).toBeInTheDocument();
  });

  it("on suggestion select: updates form coords with bbox centre and pans the map", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    searchLocationSuggestions.mockResolvedValue([
      { id: "1", title: "Istanbul", subtitle: "Türkiye", bbox: ISTANBUL_BBOX },
    ]);
    render(<MapPicker value={null} onChange={onChange} />);

    setQuery("Istanbul");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flushPromises();

    fireEvent.mouseDown(screen.getByText("Istanbul"));
    await flushPromises();

    expect(onChange).toHaveBeenCalledWith(ISTANBUL_CENTER);
    expect(fakeMap.setView).toHaveBeenCalledWith(
      [ISTANBUL_CENTER.lat, ISTANBUL_CENTER.lng],
      15
    );
    expect(
      screen.queryByRole("listbox", { name: /location suggestions/i })
    ).not.toBeInTheDocument();
  });

  it("does not pan the map when the user manually drops a pin", () => {
    const onChange = vi.fn();
    render(<MapPicker value={null} onChange={onChange} />);
    mapEventHandlers.click({ latlng: { lat: 40.0, lng: 30.0 } });
    expect(onChange).toHaveBeenCalledWith({ lat: 40.0, lng: 30.0 });
    expect(fakeMap.setView).not.toHaveBeenCalled();
  });

  it("shows a 'No results found' message when the query is 3+ chars and the API returns nothing", async () => {
    vi.useFakeTimers();
    searchLocationSuggestions.mockResolvedValue([]);
    render(<MapPicker value={null} onChange={vi.fn()} />);

    setQuery("Atlantis");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flushPromises();

    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("listbox", { name: /location suggestions/i })
    ).not.toBeInTheDocument();
  });

  it("stays interactive when the suggestions API errors out", async () => {
    vi.useFakeTimers();
    searchLocationSuggestions.mockRejectedValue(new Error("boom"));
    const onChange = vi.fn();
    render(<MapPicker value={null} onChange={onChange} />);

    setQuery("Istanbul");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flushPromises();

    expect(
      screen.queryByRole("listbox", { name: /location suggestions/i })
    ).not.toBeInTheDocument();

    mapEventHandlers.click({ latlng: { lat: 40.0, lng: 30.0 } });
    expect(onChange).toHaveBeenCalledWith({ lat: 40.0, lng: 30.0 });
  });
});
