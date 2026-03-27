import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { LoadingSpinner } from "../loading-spinner";

describe("LoadingSpinner", () => {
  it("renders with default props", () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("displays a custom message", () => {
    render(<LoadingSpinner message="Loading stories..." />);
    expect(screen.getByText("Loading stories...")).toBeInTheDocument();
  });

  it("renders screen-reader text when no message is provided", () => {
    render(<LoadingSpinner />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("applies fullPage class when fullPage prop is true", () => {
    render(<LoadingSpinner fullPage data-testid="spinner" />);
    expect(screen.getByTestId("spinner")).toHaveClass("min-h-screen");
  });

  it("does not apply fullPage class by default", () => {
    render(<LoadingSpinner data-testid="spinner" />);
    expect(screen.getByTestId("spinner")).not.toHaveClass("min-h-screen");
  });

  it("merges custom className", () => {
    render(<LoadingSpinner className="my-custom-class" data-testid="spinner" />);
    expect(screen.getByTestId("spinner")).toHaveClass("my-custom-class");
  });
});
