import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

import SnakeTimelineView from "../SnakeTimelineView";

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
      <SnakeTimelineView stories={stories} />
    </BrowserRouter>,
  );
}

describe("SnakeTimelineView", () => {
  it("renders one entry per story", () => {
    renderView([makeStory(1), makeStory(2), makeStory(3)]);

    expect(screen.getByText("Story 1")).toBeInTheDocument();
    expect(screen.getByText("Story 2")).toBeInTheDocument();
    expect(screen.getByText("Story 3")).toBeInTheDocument();
  });

  it("alternates entries left/right of the spine to produce the snake layout", () => {
    renderView([makeStory(1), makeStory(2), makeStory(3), makeStory(4)]);

    const items = screen.getAllByRole("listitem");
    const colStart = (li) =>
      li.querySelector("[class*='md:col-start-1']")
        ? "left"
        : li.querySelector("[class*='md:col-start-2']")
          ? "right"
          : null;
    expect(items.map(colStart)).toEqual(["left", "right", "left", "right"]);
  });

  it("each entry is a link to the corresponding story detail", () => {
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

  it("renders nothing when stories is empty", () => {
    renderView([]);

    expect(screen.queryByTestId("snake-timeline")).not.toBeInTheDocument();
  });

  it("renders nothing when stories is null/undefined", () => {
    renderView(null);

    expect(screen.queryByTestId("snake-timeline")).not.toBeInTheDocument();
  });
});
