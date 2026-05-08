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

  it("renders the four filter pills as a radiogroup", async () => {
    renderPage();

    expect(
      screen.getByRole("radiogroup", { name: /time window mode/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^year$/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^range$/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^decade$/i })).toBeInTheDocument();
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

    await user.click(screen.getByRole("radio", { name: /^year$/i }));
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

    await user.click(screen.getByRole("radio", { name: /^decade$/i }));
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

  it("does not fire requests for partial year input (less than 4 digits)", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(getTimeline).toHaveBeenCalled());
    const callsBefore = getTimeline.mock.calls.length;

    await user.click(screen.getByRole("radio", { name: /^year$/i }));
    const yearInput = await screen.findByLabelText(/^year$/i);
    await user.type(yearInput, "187");

    // No additional calls should be made for partial years (1, 18, 187).
    // Only the initial mount call should exist.
    expect(getTimeline.mock.calls.length).toBe(callsBefore);
  });

  it("does not fire a request when range mode has only one side filled", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(getTimeline).toHaveBeenCalled());
    const callsBefore = getTimeline.mock.calls.length;

    await user.click(screen.getByRole("radio", { name: /^range$/i }));
    const fromInput = await screen.findByLabelText(/^from$/i);
    await user.type(fromInput, "1850");

    // Only "From" is filled — no fetch should fire yet.
    expect(getTimeline.mock.calls.length).toBe(callsBefore);
    expect(screen.getByText(/enter start and end years/i)).toBeInTheDocument();
  });

  it("fires a range request when both sides are filled with 4-digit years", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(getTimeline).toHaveBeenCalled());

    await user.click(screen.getByRole("radio", { name: /^range$/i }));
    await user.type(await screen.findByLabelText(/^from$/i), "1850");
    await user.type(await screen.findByLabelText(/^to$/i), "1900");

    await waitFor(() => {
      const matched = getTimeline.mock.calls.some(
        ([arg]) => arg?.yearFrom === 1850 && arg?.yearTo === 1900,
      );
      expect(matched).toBe(true);
    });
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

  describe("search bar (q)", () => {
    it("renders the search input with mobile-parity placeholder", () => {
      renderPage();
      expect(screen.getByPlaceholderText(/search by title or place/i)).toBeInTheDocument();
    });

    it("forwards a typed query to getTimeline (debounced)", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(getTimeline).toHaveBeenCalled());

      await user.type(screen.getByPlaceholderText(/search by title or place/i), "Galata");

      await waitFor(() => {
        const matched = getTimeline.mock.calls.some(([arg]) => arg?.q === "Galata");
        expect(matched).toBe(true);
      });
    });

    it("seeds the search bar with q from the URL on mount", async () => {
      renderPage(["/timeline?q=Hagia"]);
      await waitFor(() => expect(getTimeline).toHaveBeenCalled());
      const firstArg = getTimeline.mock.calls[0][0];
      expect(firstArg.q).toBe("Hagia");
    });
  });

  describe("URL filter passthrough", () => {
    it("forwards location/tags/proximity from the URL to getTimeline", async () => {
      renderPage([
        "/timeline?location=Galata&tags=ottoman,mosque&latitude=41&longitude=29&radius_km=1",
      ]);
      await waitFor(() => expect(getTimeline).toHaveBeenCalled());
      const firstArg = getTimeline.mock.calls[0][0];
      expect(firstArg.location).toBe("Galata");
      expect(firstArg.tags).toEqual(["ottoman", "mosque"]);
      expect(firstArg.latitude).toBe(41);
      expect(firstArg.longitude).toBe(29);
      expect(firstArg.radiusKm).toBe(1);
    });
  });

  describe("active filter chips", () => {
    it("renders chips for q / location / tags / proximity", async () => {
      renderPage([
        "/timeline?q=war&location=Galata&tags=ottoman&latitude=41&longitude=29&radius_km=1",
      ]);
      await waitFor(() => expect(getTimeline).toHaveBeenCalled());
      expect(screen.getByLabelText(/active filters/i)).toBeInTheDocument();
      expect(screen.getByText('"war"')).toBeInTheDocument();
      expect(screen.getByText(/location: galata/i)).toBeInTheDocument();
      expect(screen.getByText("ottoman")).toBeInTheDocument();
      expect(screen.getByText(/within 1 km/i)).toBeInTheDocument();
    });

    it("removing a tag chip refetches without that tag", async () => {
      const user = userEvent.setup();
      renderPage(["/timeline?tags=ottoman,mosque"]);
      await waitFor(() => expect(getTimeline).toHaveBeenCalled());

      await user.click(screen.getByRole("button", { name: /remove tag filter: ottoman/i }));

      await waitFor(() => {
        const last = getTimeline.mock.calls[getTimeline.mock.calls.length - 1][0];
        expect(last.tags).toEqual(["mosque"]);
      });
    });
  });

  describe("radiogroup roving tabindex (a11y)", () => {
    it("only the checked radio is in the tab order on mount (default: All)", () => {
      renderPage();
      const all = screen.getByRole("radio", { name: /^all$/i });
      const year = screen.getByRole("radio", { name: /^year$/i });
      const range = screen.getByRole("radio", { name: /^range$/i });
      const decade = screen.getByRole("radio", { name: /^decade$/i });
      expect(all).toHaveAttribute("tabindex", "0");
      expect(year).toHaveAttribute("tabindex", "-1");
      expect(range).toHaveAttribute("tabindex", "-1");
      expect(decade).toHaveAttribute("tabindex", "-1");
    });

    it("ArrowRight from All moves focus to and selects Year", async () => {
      const user = userEvent.setup();
      renderPage();
      const all = screen.getByRole("radio", { name: /^all$/i });
      all.focus();
      await user.keyboard("{ArrowRight}");

      const year = screen.getByRole("radio", { name: /^year$/i });
      expect(year).toHaveAttribute("aria-checked", "true");
      expect(year).toHaveAttribute("tabindex", "0");
      expect(all).toHaveAttribute("tabindex", "-1");
      expect(year).toHaveFocus();
    });

    it("ArrowLeft from All wraps around to Decade", async () => {
      const user = userEvent.setup();
      renderPage();
      const all = screen.getByRole("radio", { name: /^all$/i });
      all.focus();
      await user.keyboard("{ArrowLeft}");

      const decade = screen.getByRole("radio", { name: /^decade$/i });
      expect(decade).toHaveAttribute("aria-checked", "true");
      expect(decade).toHaveFocus();
    });

    it("Home / End jump to first / last", async () => {
      const user = userEvent.setup();
      renderPage();
      const range = screen.getByRole("radio", { name: /^range$/i });
      // Click range first so we have somewhere to jump from.
      await user.click(range);
      range.focus();
      await user.keyboard("{Home}");
      expect(screen.getByRole("radio", { name: /^all$/i })).toHaveAttribute("aria-checked", "true");

      const all = screen.getByRole("radio", { name: /^all$/i });
      all.focus();
      await user.keyboard("{End}");
      expect(screen.getByRole("radio", { name: /^decade$/i })).toHaveAttribute(
        "aria-checked",
        "true",
      );
    });
  });
});
