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

  it("renders only the formatTimePeriod label chip — no decade chip for non-decade stories", () => {
    renderEntry({
      id: 1,
      title: "T",
      time_type: "exact_year",
      year: 1920,
      year_start: null,
      year_end: null,
      location_lat: null,
      location_lng: null,
      photo_url: null,
      temporal_coverage: "1920",
    });

    // "1920" appears only as the bullet — the in-card chip is removed
    const chips = screen.getAllByText("1920");
    expect(chips.length).toBe(1);
    expect(screen.queryByText("1920s")).not.toBeInTheDocument();
  });

  it("does not render a temporal_coverage chip even when the field is present", () => {
    renderEntry({
      id: 1,
      title: "T",
      time_type: "approx_year",
      year: 1920,
      year_start: null,
      year_end: null,
      location_lat: null,
      location_lng: null,
      photo_url: null,
      temporal_coverage: "~1920",
    });

    expect(screen.queryByText("~1920")).not.toBeInTheDocument();
  });

  it("renders BC years on the bullet without a minus sign", () => {
    renderEntry({
      id: 1,
      title: "Roman story",
      time_type: "exact_year",
      year: -44,
      year_start: null,
      year_end: null,
      location_lat: null,
      location_lng: null,
      photo_url: null,
      temporal_coverage: null,
    });

    expect(screen.getAllByText("44 BC").length).toBeGreaterThan(0);
    expect(screen.queryByText(/^-44/)).not.toBeInTheDocument();
  });

  it("derives the decade chip from a BC year as 'XXs BC'", () => {
    renderEntry({
      id: 1,
      title: "Roman story",
      time_type: "decade",
      year: -44,
      year_start: null,
      year_end: null,
      location_lat: null,
      location_lng: null,
      photo_url: null,
      temporal_coverage: null,
    });

    expect(screen.getByText("50s BC")).toBeInTheDocument();
  });

  it("formats the date_value fallback as 'X BC' instead of leaking the raw negative", () => {
    renderEntry({
      id: 1,
      title: "Story with malformed BC date_value",
      time_type: "exact_date",
      year: null,
      year_start: null,
      year_end: null,
      // Malformed BC date_value triggers the bulletLabel fallback path. Without
      // the fix, the fallback would emit the raw "-0044" match.
      date_value: "-0044-03-15",
      location_lat: null,
      location_lng: null,
      photo_url: null,
      temporal_coverage: null,
    });

    expect(screen.getAllByText("44 BC").length).toBeGreaterThan(0);
    expect(screen.queryByText(/-0044/)).not.toBeInTheDocument();
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

  it("shows mapped coordinates when lat/lng are present and no location_name", () => {
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

  it("prefers location_name over raw coordinates when provided", () => {
    renderEntry({
      id: 1,
      title: "Named Story",
      time_type: "exact_year",
      year: 1875,
      year_start: null,
      year_end: null,
      location_lat: 41.0258,
      location_lng: 28.9744,
      location_name: "Galata Bridge, Istanbul",
      photo_url: null,
      temporal_coverage: null,
    });

    expect(screen.getByText("Galata Bridge, Istanbul")).toBeInTheDocument();
    expect(screen.queryByText(/41\.0258/)).not.toBeInTheDocument();
  });
});
