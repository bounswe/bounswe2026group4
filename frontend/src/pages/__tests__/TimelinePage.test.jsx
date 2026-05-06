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

  it("renders the four filter pills", async () => {
    renderPage();

    expect(screen.getByRole("button", { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^year$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^range$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^decade$/i })).toBeInTheDocument();
  });

  it("fetches with no year params on first render (default All)", async () => {
    renderPage();

    await waitFor(() => {
      expect(getTimeline).toHaveBeenCalled();
    });

    const firstCallArgs = getTimeline.mock.calls[0][0];
    expect(firstCallArgs.yearFrom).toBeUndefined();
    expect(firstCallArgs.yearTo).toBeUndefined();
    expect(firstCallArgs.page).toBe(1);
  });

  it("switches to Year + entering 1875 fetches with year_from=year_to=1875", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(getTimeline).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /^year$/i }));
    const yearInput = await screen.findByLabelText(/^year$/i);
    await user.clear(yearInput);
    await user.type(yearInput, "1875");

    await waitFor(() => {
      const calls = getTimeline.mock.calls;
      const matched = calls.some(
        ([arg]) => arg?.yearFrom === 1875 && arg?.yearTo === 1875,
      );
      expect(matched).toBe(true);
    });
  });

  it("Decade with 1875 fetches with year_from=1870 and year_to=1879", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(getTimeline).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /^decade$/i }));
    const decadeInput = await screen.findByLabelText(/decade/i);
    await user.clear(decadeInput);
    await user.type(decadeInput, "1875");

    await waitFor(() => {
      const matched = getTimeline.mock.calls.some(
        ([arg]) => arg?.yearFrom === 1870 && arg?.yearTo === 1879,
      );
      expect(matched).toBe(true);
    });
  });

  it("shows empty state when count is 0", async () => {
    getTimeline.mockResolvedValue(makeResponse({ count: 0, results: [] }));
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/no stories found for this time window/i),
      ).toBeInTheDocument();
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
      expect(screen.getByText("Story 2")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /load more/i }));

    await waitFor(() => {
      expect(screen.getByText("Story 3")).toBeInTheDocument();
      expect(screen.getByText("Story 4")).toBeInTheDocument();
    });
    // Previously-loaded stories should remain visible
    expect(screen.getByText("Story 1")).toBeInTheDocument();

    const lastArgs = getTimeline.mock.calls[getTimeline.mock.calls.length - 1][0];
    expect(lastArgs.page).toBe(2);
  });

  it("passes bbox query string params through to the service", async () => {
    renderPage([
      "/timeline?lat_min=40&lat_max=41&lng_min=28&lng_max=29",
    ]);

    await waitFor(() => {
      expect(getTimeline).toHaveBeenCalled();
    });

    const args = getTimeline.mock.calls[0][0];
    expect(args.latMin).toBe(40);
    expect(args.latMax).toBe(41);
    expect(args.lngMin).toBe(28);
    expect(args.lngMax).toBe(29);
  });
});
