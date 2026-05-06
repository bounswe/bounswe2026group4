import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

import TimelineView from "../TimelineView";

function makeStory(id, overrides = {}) {
  return {
    id,
    title: `Story ${id}`,
    time_type: "exact_year",
    year: 1900 + id,
    year_start: null,
    year_end: null,
    location_lat: null,
    location_lng: null,
    photo_url: null,
    temporal_coverage: null,
    ...overrides,
  };
}

function renderView(stories) {
  return render(
    <BrowserRouter>
      <TimelineView stories={stories} />
    </BrowserRouter>,
  );
}

describe("TimelineView", () => {
  it("renders one entry per story", () => {
    renderView([makeStory(1), makeStory(2), makeStory(3)]);

    expect(screen.getByText("Story 1")).toBeInTheDocument();
    expect(screen.getByText("Story 2")).toBeInTheDocument();
    expect(screen.getByText("Story 3")).toBeInTheDocument();
  });

  it("passes story prop down so each story links to its detail page", () => {
    renderView([makeStory(7), makeStory(8)]);

    expect(screen.getByRole("link", { name: /story 7/i })).toHaveAttribute(
      "href",
      "/stories/7",
    );
    expect(screen.getByRole("link", { name: /story 8/i })).toHaveAttribute(
      "href",
      "/stories/8",
    );
  });

  it("renders nothing visible (no entries) when stories is empty", () => {
    renderView([]);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
