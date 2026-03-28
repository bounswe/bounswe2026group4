import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

import StoryCard from "../StoryCard";
import { getPreview, formatTimePeriod } from "../storyCardUtils";

function makeStory(overrides = {}) {
  return {
    id: 1,
    title: "The Ancient Bridge",
    preview_text: "Once upon a time there was a bridge that spanned the river in the heart of the old city.",
    location_name: "Old City",
    time_type: "exact_year",
    year: 1453,
    year_start: null,
    year_end: null,
    contributor_name: "historian_01",
    images: [],
    ...overrides,
  };
}

function renderCard(story) {
  return render(
    <BrowserRouter>
      <StoryCard story={story} />
    </BrowserRouter>
  );
}

// --- Unit tests for helpers ---

describe("getPreview", () => {
  it("returns full text when 20 words or fewer", () => {
    const text = "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty";
    expect(getPreview(text)).toBe(text);
  });

  it("truncates and appends ellipsis beyond 20 words", () => {
    const text = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone";
    const result = getPreview(text);
    expect(result).toMatch(/\u2026$/);
    // Ellipsis is appended directly to word 20 (no space), so splitting gives 20 tokens
    expect(result.split(/\s+/).length).toBe(20);
    expect(result).not.toContain("twentyone");
  });

  it("returns empty string for falsy input", () => {
    expect(getPreview(null)).toBe("");
    expect(getPreview(undefined)).toBe("");
    expect(getPreview("")).toBe("");
  });
});

describe("formatTimePeriod", () => {
  it("formats exact_year", () => {
    expect(formatTimePeriod({ time_type: "exact_year", year: 1453 })).toBe("1453");
  });

  it("formats approximate_year with c. prefix", () => {
    const result = formatTimePeriod({ time_type: "approximate_year", year: 1200 });
    expect(result).toMatch(/^c\.\s*1200$/);
  });

  it("formats decade", () => {
    expect(formatTimePeriod({ time_type: "decade", year: 1456 })).toBe("1450s");
    expect(formatTimePeriod({ time_type: "decade", year: 1900 })).toBe("1900s");
  });

  it("formats year_range", () => {
    expect(
      formatTimePeriod({ time_type: "year_range", year_start: 1400, year_end: 1500 })
    ).toBe("1400\u20131500");
  });

  it("returns empty string for unknown time_type", () => {
    expect(formatTimePeriod({ time_type: "unknown" })).toBe("");
  });
});

// --- StoryCard rendering tests ---

describe("StoryCard", () => {
  it("renders the story title", () => {
    renderCard(makeStory());
    expect(screen.getByText("The Ancient Bridge")).toBeInTheDocument();
  });

  it("renders the location name", () => {
    renderCard(makeStory());
    expect(screen.getByText("Old City")).toBeInTheDocument();
  });

  it("renders the formatted time period", () => {
    renderCard(makeStory({ time_type: "exact_year", year: 1453 }));
    expect(screen.getByText("1453")).toBeInTheDocument();
  });

  it("renders preview_text from the feed API", () => {
    renderCard(makeStory({ preview_text: "A glimpse into the past…" }));
    expect(screen.getByText("A glimpse into the past…")).toBeInTheDocument();
  });

  it("renders nothing for preview when preview_text is absent", () => {
    const story = makeStory();
    delete story.preview_text;
    renderCard(story);
    // No preview paragraph — just check no crash and title still renders
    expect(screen.getByText("The Ancient Bridge")).toBeInTheDocument();
  });

  it("shows media icon when story has images", () => {
    renderCard(makeStory({ images: [{ id: 1, url: "photo.jpg" }] }));
    expect(screen.getByLabelText("Has media")).toBeInTheDocument();
  });

  it("hides media icon when story has no images", () => {
    renderCard(makeStory({ images: [] }));
    expect(screen.queryByLabelText("Has media")).not.toBeInTheDocument();
  });

  it("hides media icon when images is undefined", () => {
    const story = makeStory();
    delete story.images;
    renderCard(story);
    expect(screen.queryByLabelText("Has media")).not.toBeInTheDocument();
  });

  it("card link points to /stories/:id", () => {
    renderCard(makeStory({ id: 42 }));
    const link = screen.getByRole("link", { name: /read story: the ancient bridge/i });
    expect(link).toHaveAttribute("href", "/stories/42");
  });

  it("renders year_range time period", () => {
    renderCard(makeStory({ time_type: "year_range", year_start: 1400, year_end: 1500 }));
    expect(screen.getByText("1400\u20131500")).toBeInTheDocument();
  });

  it("renders approximate_year time period", () => {
    renderCard(makeStory({ time_type: "approximate_year", year: 1200 }));
    // Use regex to match regardless of how the non-breaking space is normalized
    expect(screen.getByText(/c\.\s*1200/)).toBeInTheDocument();
  });

  it("renders decade time period", () => {
    renderCard(makeStory({ time_type: "decade", year: 1450 }));
    expect(screen.getByText("1450s")).toBeInTheDocument();
  });

  it("does not render like count section when like_count is absent", () => {
    renderCard(makeStory());
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders like count when positive", () => {
    renderCard(makeStory({ like_count: 7 }));
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
