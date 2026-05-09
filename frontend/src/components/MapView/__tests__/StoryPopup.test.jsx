import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StoryPopup from "../StoryPopup";

function renderPopup(story) {
  return render(<StoryPopup story={story} />);
}

describe("StoryPopup", () => {
  const baseStory = {
    id: 42,
    title: "The Old Bridge",
    location_name: "Istanbul",
    location_lat: 41.01,
    location_lng: 28.97,
    time_type: "exact_year",
    year: 1920,
  };

  it("renders title, location, and time period", () => {
    renderPopup(baseStory);

    expect(screen.getByText("The Old Bridge")).toBeInTheDocument();
    expect(screen.getByText("Istanbul")).toBeInTheDocument();
    expect(screen.getByText("1920")).toBeInTheDocument();
  });

  it("handles missing location_name", () => {
    renderPopup({ ...baseStory, location_name: undefined });

    expect(screen.getByText("The Old Bridge")).toBeInTheDocument();
    expect(screen.queryByText("Istanbul")).not.toBeInTheDocument();
  });

  it("'Read more' links to the correct story URL", () => {
    renderPopup(baseStory);

    const link = screen.getByText("Read more");
    expect(link.closest("a")).toHaveAttribute("href", "/stories/42");
  });

  it("renders a 'View Timeline' link to /timeline with the pin's proximity params pre-applied", () => {
    renderPopup(baseStory);

    const link = screen.getByText("View Timeline");
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "/timeline?latitude=41.01&longitude=28.97&radius_km=0.5",
    );
  });

  it("omits the 'View Timeline' link when coordinates are missing", () => {
    renderPopup({ ...baseStory, location_lat: undefined, location_lng: undefined });

    expect(screen.queryByText("View Timeline")).not.toBeInTheDocument();
  });

  it("omits the 'View Timeline' link when coordinates are non-numeric", () => {
    renderPopup({ ...baseStory, location_lat: "n/a", location_lng: "n/a" });

    expect(screen.queryByText("View Timeline")).not.toBeInTheDocument();
  });
});
