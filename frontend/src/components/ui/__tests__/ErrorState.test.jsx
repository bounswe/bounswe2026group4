import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ErrorState } from "../error-state";

describe("ErrorState", () => {
  it("renders with default props", () => {
    render(<ErrorState />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("displays a custom title", () => {
    render(<ErrorState title="Failed to load stories" />);
    expect(screen.getByText("Failed to load stories")).toBeInTheDocument();
  });

  it("displays a custom message", () => {
    render(<ErrorState message="The server is currently unavailable." />);
    expect(
      screen.getByText("The server is currently unavailable.")
    ).toBeInTheDocument();
  });

  it("does not render retry button when onRetry is not provided", () => {
    render(<ErrorState />);
    expect(
      screen.queryByRole("button", { name: /try again/i })
    ).not.toBeInTheDocument();
  });

  it("renders retry button when onRetry is provided", () => {
    render(<ErrorState onRetry={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });

  it("calls onRetry when retry button is clicked", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("displays a custom retry label", () => {
    render(<ErrorState onRetry={vi.fn()} retryLabel="Reload page" />);
    expect(
      screen.getByRole("button", { name: /reload page/i }
    )).toBeInTheDocument();
  });

  it("has role=alert for accessibility", () => {
    render(<ErrorState />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
