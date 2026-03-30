import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StoryPopup from "../StoryPopup";

function renderPopup(story) {
  return render(
    <MemoryRouter>
      <StoryPopup story={story} />
    </MemoryRouter>,
  );
}

describe("StoryPopup", () => {
  const baseStory = {
    id: 42,
    title: "The Old Bridge",
    location_name: "Istanbul",
    time_type: "exact_year",
    year: 1920,
    preview_text: "A short preview.",
  };

  it("renders title, location, time period, and preview", () => {
    renderPopup(baseStory);

    expect(screen.getByText("The Old Bridge")).toBeInTheDocument();
    expect(screen.getByText("Istanbul")).toBeInTheDocument();
    expect(screen.getByText("1920")).toBeInTheDocument();
    expect(screen.getByText("A short preview.")).toBeInTheDocument();
  });

  it("truncates preview at 20 words with ellipsis", () => {
    const longPreview = Array.from({ length: 25 }, (_, i) => `word${i}`).join(" ");
    renderPopup({ ...baseStory, preview_text: longPreview });

    const expected = Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ") + "...";
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("handles missing location_name", () => {
    renderPopup({ ...baseStory, location_name: undefined });

    expect(screen.getByText("The Old Bridge")).toBeInTheDocument();
    expect(screen.queryByText("Istanbul")).not.toBeInTheDocument();
  });

  it("handles missing preview_text", () => {
    renderPopup({ ...baseStory, preview_text: undefined });

    expect(screen.getByText("The Old Bridge")).toBeInTheDocument();
    // No preview paragraph should be rendered
    const link = screen.getByText("Read more");
    expect(link).toBeInTheDocument();
  });

  it("'Read more' links to the correct story URL", () => {
    renderPopup(baseStory);

    const link = screen.getByText("Read more");
    expect(link.closest("a")).toHaveAttribute("href", "/stories/42");
  });
});
