import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

import TimelineEntry from "../TimelineEntry";

function renderEntry(story) {
  return render(
    <BrowserRouter>
      <TimelineEntry story={story} />
    </BrowserRouter>,
  );
}

describe("TimelineEntry", () => {
  it("renders the story title", () => {
    renderEntry({
      id: 1,
      title: "Galata Bridge Opening",
      time_type: "exact_year",
      year: 1875,
      year_start: null,
      year_end: null,
      location_lat: 41.0,
      location_lng: 28.9,
      photo_url: null,
      temporal_coverage: null,
    });

    expect(screen.getByText("Galata Bridge Opening")).toBeInTheDocument();
  });

  it("links the card to /stories/<id>", () => {
    renderEntry({
      id: 42,
      title: "A story",
      time_type: "exact_year",
      year: 1900,
      year_start: null,
      year_end: null,
      location_lat: null,
      location_lng: null,
      photo_url: null,
      temporal_coverage: null,
    });

    const link = screen.getByRole("link", { name: /a story/i });
    expect(link).toHaveAttribute("href", "/stories/42");
  });

  it("renders the year as the bullet label for exact_year", () => {
    renderEntry({
      id: 1,
      title: "T",
      time_type: "exact_year",
      year: 1875,
      year_start: null,
      year_end: null,
      location_lat: null,
      location_lng: null,
      photo_url: null,
      temporal_coverage: null,
    });

    expect(screen.getAllByText("1875").length).toBeGreaterThan(0);
  });

  it("renders the decade as the bullet label for decade time_type", () => {
    renderEntry({
      id: 1,
      title: "T",
      time_type: "decade",
      year: 1875,
      year_start: null,
      year_end: null,
      location_lat: null,
      location_lng: null,
      photo_url: null,
      temporal_coverage: null,
    });

    expect(screen.getAllByText("1870s").length).toBeGreaterThan(0);
  });

  it("renders the photo when photo_url is provided", () => {
    renderEntry({
      id: 1,
      title: "Story With Photo",
      time_type: "exact_year",
      year: 1875,
      year_start: null,
      year_end: null,
      location_lat: 41.0,
      location_lng: 28.9,
      photo_url: "https://example.com/photo.jpg",
      temporal_coverage: null,
    });

    const img = screen.getByRole("img", { name: /story with photo/i });
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
  });

  it("does not render any image when photo_url is null", () => {
    renderEntry({
      id: 1,
      title: "Story Without Photo",
      time_type: "exact_year",
      year: 1875,
      year_start: null,
      year_end: null,
      location_lat: 41.0,
      location_lng: 28.9,
      photo_url: null,
      temporal_coverage: null,
    });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows mapped coordinates when lat/lng are present", () => {
    renderEntry({
      id: 1,
      title: "Mapped Story",
      time_type: "exact_year",
      year: 1875,
      year_start: null,
      year_end: null,
      location_lat: 41.0258,
      location_lng: 28.9744,
      photo_url: null,
      temporal_coverage: null,
    });

    expect(screen.getByText(/41\.0258/)).toBeInTheDocument();
    expect(screen.getByText(/28\.9744/)).toBeInTheDocument();
  });
});
