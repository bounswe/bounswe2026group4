import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/services/timelineService", () => ({
  getTimeline: vi.fn(),
}));

import { getTimeline } from "@/services/timelineService";
import NearbyTimelinePage from "../NearbyTimelinePage";

function makeStory(id, overrides = {}) {
  return {
    id,
    title: `Story ${id}`,
    time_type: "exact_year",
    year: 1900 + id,
    year_start: null,
    year_end: null,
    date_value: null,
    time_value: null,
    location_lat: null,
    location_lng: null,
    photo_url: null,
    temporal_coverage: null,
    ...overrides,
  };
}

function makeResponse({ count = 0, results = [], next = null } = {}) {
  return { count, next, previous: null, results };
}

function renderPage(initialEntries = ["/nearby-timeline?latitude=41.01&longitude=28.97"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <NearbyTimelinePage />
    </MemoryRouter>,
  );
}

describe("NearbyTimelinePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTimeline.mockResolvedValue(makeResponse());
  });

  it("renders the page heading and back-to-map link", async () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /stories nearby/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to map/i })).toHaveAttribute(
      "href",
      "/map",
    );
  });

  it("calls getTimeline with the lat/lng from the URL and the default 0.5 km radius", async () => {
    renderPage();
    await waitFor(() => expect(getTimeline).toHaveBeenCalled());
    const args = getTimeline.mock.calls[0][0];
    expect(args.latitude).toBe(41.01);
    expect(args.longitude).toBe(28.97);
    expect(args.radiusKm).toBe(0.5);
    expect(args.page).toBe(1);
  });

  it("honours an explicit radius_km URL param", async () => {
    renderPage(["/nearby-timeline?latitude=41&longitude=29&radius_km=2"]);
    await waitFor(() => expect(getTimeline).toHaveBeenCalled());
    expect(getTimeline.mock.calls[0][0].radiusKm).toBe(2);
  });

  it("displays the radius and pin coordinates in the subtitle (radius < 1 km shown in metres)", () => {
    renderPage(["/nearby-timeline?latitude=41.0123&longitude=28.9876"]);
    const subtitle = screen.getByTestId("nearby-timeline-subtitle");
    expect(subtitle).toHaveTextContent(/within 500 m of 41\.0123, 28\.9876/i);
  });

  it("displays the radius in km when 1 km or larger", () => {
    renderPage(["/nearby-timeline?latitude=41&longitude=29&radius_km=2"]);
    expect(screen.getByTestId("nearby-timeline-subtitle")).toHaveTextContent(
      /within 2 km/i,
    );
  });

  it("shows the empty state with the radius when no stories are returned", async () => {
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText(/no stories within 500 m of this point/i),
      ).toBeInTheDocument(),
    );
  });

  it("renders the snake timeline with returned stories sorted oldest-first by getTimeline", async () => {
    getTimeline.mockResolvedValueOnce(
      makeResponse({
        count: 3,
        results: [makeStory(1), makeStory(2), makeStory(3)],
      }),
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("snake-timeline")).toBeInTheDocument(),
    );
    expect(screen.getByText("Story 1")).toBeInTheDocument();
    expect(screen.getByText("Story 2")).toBeInTheDocument();
    expect(screen.getByText("Story 3")).toBeInTheDocument();
    expect(screen.getByText(/3 stories/i)).toBeInTheDocument();
  });

  it("uses singular 'story' when exactly one result is returned", async () => {
    getTimeline.mockResolvedValueOnce(
      makeResponse({ count: 1, results: [makeStory(1)] }),
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/1 story\b/i)).toBeInTheDocument(),
    );
  });

  it("shows the loading spinner while the request is in flight", async () => {
    let resolve;
    getTimeline.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    renderPage();
    expect(screen.getByLabelText(/loading nearby stories/i)).toBeInTheDocument();
    resolve(makeResponse());
    await waitFor(() =>
      expect(screen.queryByLabelText(/loading nearby stories/i)).not.toBeInTheDocument(),
    );
  });

  it("shows an error message and a retry button when the request fails", async () => {
    const user = userEvent.setup();
    getTimeline.mockRejectedValueOnce(new Error("boom"));
    renderPage();
    await waitFor(() => expect(screen.getByText(/boom/i)).toBeInTheDocument());

    getTimeline.mockResolvedValueOnce(
      makeResponse({ count: 1, results: [makeStory(1)] }),
    );
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() =>
      expect(screen.getByTestId("snake-timeline")).toBeInTheDocument(),
    );
  });

  it("does not call getTimeline when lat or lng are missing, and shows the validation message", () => {
    renderPage(["/nearby-timeline"]);
    expect(getTimeline).not.toHaveBeenCalled();
    expect(
      screen.getByText(/a valid latitude and longitude are required/i),
    ).toBeInTheDocument();
  });

  it("does not call getTimeline when latitude is out of range (> 90)", () => {
    renderPage(["/nearby-timeline?latitude=120&longitude=29"]);
    expect(getTimeline).not.toHaveBeenCalled();
    expect(
      screen.getByText(/a valid latitude and longitude are required/i),
    ).toBeInTheDocument();
  });
});
