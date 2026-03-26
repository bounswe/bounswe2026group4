import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Skeleton, SkeletonCard, SkeletonPage, LoadingSkeleton } from "../loading-skeleton";

describe("Skeleton", () => {
  it("renders without crashing", () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("has animate-pulse class", () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId("skeleton")).toHaveClass("animate-pulse");
  });

  it("merges custom className", () => {
    render(<Skeleton className="h-4 w-full" data-testid="skeleton" />);
    expect(screen.getByTestId("skeleton")).toHaveClass("h-4", "w-full");
  });
});

describe("SkeletonCard", () => {
  it("renders multiple skeleton blocks", () => {
    render(<SkeletonCard data-testid="skeleton-card" />);
    expect(screen.getByTestId("skeleton-card")).toBeInTheDocument();
    // Should contain multiple children for image + text lines
    const children = screen.getByTestId("skeleton-card").children;
    expect(children.length).toBeGreaterThan(1);
  });
});

describe("SkeletonPage", () => {
  it("renders without crashing", () => {
    render(<SkeletonPage data-testid="skeleton-page" />);
    expect(screen.getByTestId("skeleton-page")).toBeInTheDocument();
  });
});

describe("LoadingSkeleton", () => {
  it("is an alias for Skeleton", () => {
    render(<LoadingSkeleton data-testid="loading-skeleton" />);
    expect(screen.getByTestId("loading-skeleton")).toHaveClass("animate-pulse");
  });
});
