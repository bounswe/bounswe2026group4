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
    // Coords are rounded to 6 decimals (toFixed(6)) before going into the URL.
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "/timeline?latitude=41.010000&longitude=28.970000&radius_km=0.5",
    );
  });

  it("rounds raw GeoJSON-precision coordinates to 6 decimals in the View Timeline href", () => {
    renderPopup({
      ...baseStory,
      location_lat: 41.0123456789,
      location_lng: 28.9876543210,
    });

    expect(screen.getByText("View Timeline").closest("a")).toHaveAttribute(
      "href",
      "/timeline?latitude=41.012346&longitude=28.987654&radius_km=0.5",
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

describe("StoryPopup date rendering", () => {
  it("renders an exact_date story with date_value correctly (bug fix: was blank before)", () => {
    renderPopup({
      id: 1,
      title: "Battle of Manzikert",
      time_type: "exact_date",
      date_value: "1071-08-26",
    });

    expect(screen.getByText("Aug 26, 1071")).toBeInTheDocument();
  });

  it("renders an exact_date with time_value showing HH:MM", () => {
    renderPopup({
      id: 2,
      title: "Armistice",
      time_type: "exact_date",
      date_value: "1918-11-11",
      time_value: "11:00",
    });

    expect(screen.getByText("Nov 11, 1918 11:00")).toBeInTheDocument();
  });

  it("renders a BC year correctly", () => {
    renderPopup({
      id: 3,
      title: "Assassination of Caesar",
      time_type: "exact_year",
      year: -44,
    });

    expect(screen.getByText("44 BC")).toBeInTheDocument();
  });

  it("renders a BC year_range correctly", () => {
    renderPopup({
      id: 4,
      title: "Punic Wars",
      time_type: "year_range",
      year_start: -264,
      year_end: -146,
    });

    expect(screen.getByText("264–146 BC")).toBeInTheDocument();
  });

  it("renders approximate_year with 'c.' prefix", () => {
    renderPopup({
      id: 5,
      title: "Early Settlement",
      time_type: "approximate_year",
      year: 500,
    });

    expect(screen.getByText("c. 500")).toBeInTheDocument();
  });

  it("renders a decade", () => {
    renderPopup({
      id: 6,
      title: "The Roaring Years",
      time_type: "decade",
      year: 1920,
    });

    expect(screen.getByText("1920s")).toBeInTheDocument();
  });

  it("omits the date row when time_type is absent", () => {
    const { container } = renderPopup({
      id: 7,
      title: "No Date Story",
      time_type: null,
    });

    // No Calendar icon should appear
    expect(container.querySelectorAll("svg").length).toBe(0);
  });
});

describe("StoryPopup icons", () => {
  it("renders a MapPin icon alongside the location text", () => {
    const { container } = renderPopup({
      id: 10,
      title: "Story",
      location_name: "Ankara",
      time_type: null,
    });

    // Location row should contain one SVG (the MapPin icon)
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders a Calendar icon alongside the time period", () => {
    const { container } = renderPopup({
      id: 11,
      title: "Story",
      time_type: "exact_year",
      year: 1453,
    });

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders both MapPin and Calendar icons when location and date are present", () => {
    const { container } = renderPopup({
      id: 12,
      title: "Story",
      location_name: "Edirne",
      time_type: "exact_year",
      year: 1453,
    });

    expect(container.querySelectorAll("svg").length).toBe(2);
  });

  it("renders no icons when both location and date are absent", () => {
    const { container } = renderPopup({
      id: 13,
      title: "Story with nothing",
      time_type: null,
    });

    expect(container.querySelectorAll("svg").length).toBe(0);
  });
});

