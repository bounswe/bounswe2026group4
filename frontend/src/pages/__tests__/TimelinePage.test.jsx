import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/services/timelineService", () => ({
  getTimeline: vi.fn(),
}));

import { getTimeline } from "@/services/timelineService";
import TimelinePage from "../TimelinePage";

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
    temporal_coverage: null,
    location_lat: null,
    location_lng: null,
    photo_url: null,
    ...overrides,
  };
}

function makeResponse({ count = 0, results = [], next = null } = {}) {
  return { count, next, previous: null, results };
}

function renderPage(initialEntries = ["/timeline"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <TimelinePage />
    </MemoryRouter>,
  );
}

describe("TimelinePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTimeline.mockResolvedValue(makeResponse());
  });

  it("renders the Timeline heading", async () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /^timeline$/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("does not render the legacy 'Choose a time window' card or mode radiogroup (sezindogan review)", async () => {
    renderPage();
    expect(screen.queryByText(/choose a time window/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: /time window mode/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the Filters button but no search bar input", async () => {
    renderPage();
    expect(screen.getByRole("button", { name: /^filters$/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search by title or place/i)).not.toBeInTheDocument();
  });

  it("fetches with no year params on first render (no URL filters)", async () => {
    renderPage();
    await waitFor(() => expect(getTimeline).toHaveBeenCalled());

    const args = getTimeline.mock.calls[0][0];
    expect(args.yearFrom).toBeUndefined();
    expect(args.yearTo).toBeUndefined();
    expect(args.page).toBe(1);
  });

  it("seeds year_from / year_to from the URL and forwards them to getTimeline", async () => {
    renderPage(["/timeline?year_from=1850&year_to=1900"]);
    await waitFor(() => expect(getTimeline).toHaveBeenCalled());

    const args = getTimeline.mock.calls[0][0];
    expect(args.yearFrom).toBe(1850);
    expect(args.yearTo).toBe(1900);
  });

  it("forwards has_image=true from the URL", async () => {
    renderPage(["/timeline?has_image=true"]);
    await waitFor(() => expect(getTimeline).toHaveBeenCalled());
    expect(getTimeline.mock.calls[0][0].hasImage).toBe(true);
  });

  it("does not pass q to getTimeline even when q is present in the URL", async () => {
    renderPage(["/timeline?q=hagia"]);
    await waitFor(() => expect(getTimeline).toHaveBeenCalled());
    expect(getTimeline.mock.calls[0][0].q).toBeUndefined();
  });

  it("forwards URL filters (location, tags, proximity) to getTimeline", async () => {
    renderPage([
      "/timeline?location=Galata&tags=ottoman,mosque&latitude=41&longitude=29&radius_km=1",
    ]);
    await waitFor(() => expect(getTimeline).toHaveBeenCalled());
    const args = getTimeline.mock.calls[0][0];
    expect(args.location).toBe("Galata");
    expect(args.tags).toEqual(["ottoman", "mosque"]);
    expect(args.latitude).toBe(41);
    expect(args.longitude).toBe(29);
    expect(args.radiusKm).toBe(1);
  });

  it("renders dismissible chips for year_range / location / tags / has_image (no q chip)", async () => {
    renderPage([
      "/timeline?year_from=1850&year_to=1900&location=Galata&tags=ottoman&has_image=true",
    ]);
    await waitFor(() => expect(getTimeline).toHaveBeenCalled());

    expect(screen.getByLabelText(/active filters/i)).toBeInTheDocument();
    expect(screen.getByText("1850–1900")).toBeInTheDocument();
    expect(screen.getByText(/location: galata/i)).toBeInTheDocument();
    expect(screen.getByText("ottoman")).toBeInTheDocument();
    expect(screen.getByText(/^has image$/i)).toBeInTheDocument();
    expect(screen.queryByText(/"war"/)).not.toBeInTheDocument();
  });

  it("removing the year-range chip clears year_from / year_to and refetches", async () => {
    const user = userEvent.setup();
    renderPage(["/timeline?year_from=1850&year_to=1900"]);
    await waitFor(() => expect(getTimeline).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /remove filter:.*1850/i }));

    await waitFor(() => {
      const last = getTimeline.mock.calls[getTimeline.mock.calls.length - 1][0];
      expect(last.yearFrom).toBeUndefined();
      expect(last.yearTo).toBeUndefined();
    });
  });

  it("removing the Has-image chip clears has_image", async () => {
    const user = userEvent.setup();
    renderPage(["/timeline?has_image=true"]);
    await waitFor(() => expect(getTimeline).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /remove filter: has image/i }));

    await waitFor(() => {
      const last = getTimeline.mock.calls[getTimeline.mock.calls.length - 1][0];
      expect(last.hasImage).toBe(false);
    });
  });

  it("shows empty state when count is 0", async () => {
    getTimeline.mockResolvedValue(makeResponse({ count: 0, results: [] }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no stories found for these filters/i)).toBeInTheDocument();
    });
  });

  it("shows count of stories", async () => {
    getTimeline.mockResolvedValue(
      makeResponse({ count: 3, results: [makeStory(1), makeStory(2), makeStory(3)] }),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/3 stories/i)).toBeInTheDocument();
    });
  });

  it("Load more button appends next page results", async () => {
    const user = userEvent.setup();
    getTimeline
      .mockResolvedValueOnce(
        makeResponse({
          count: 4,
          results: [makeStory(1), makeStory(2)],
          next: "http://localhost:8000/api/stories/timeline/?page=2",
        }),
      )
      .mockResolvedValueOnce(
        makeResponse({
          count: 4,
          results: [makeStory(3), makeStory(4)],
          next: null,
        }),
      );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Story 1")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /load more/i }));

    await waitFor(() => {
      expect(screen.getByText("Story 3")).toBeInTheDocument();
    });
    expect(screen.getByText("Story 1")).toBeInTheDocument();

    const lastArgs = getTimeline.mock.calls[getTimeline.mock.calls.length - 1][0];
    expect(lastArgs.page).toBe(2);
  });

  it("passes bbox query string params through to the service", async () => {
    renderPage(["/timeline?lat_min=40&lat_max=41&lng_min=28&lng_max=29"]);
    await waitFor(() => expect(getTimeline).toHaveBeenCalled());
    const args = getTimeline.mock.calls[0][0];
    expect(args.latMin).toBe(40);
    expect(args.latMax).toBe(41);
    expect(args.lngMin).toBe(28);
    expect(args.lngMax).toBe(29);
  });
});
