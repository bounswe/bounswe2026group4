import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookOpen } from "lucide-react";

import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("renders with default props", () => {
    render(<EmptyState />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("displays a custom title", () => {
    render(<EmptyState title="No stories found" />);
    expect(screen.getByText("No stories found")).toBeInTheDocument();
  });

  it("displays a custom message", () => {
    render(<EmptyState message="Be the first to share a story." />);
    expect(
      screen.getByText("Be the first to share a story.")
    ).toBeInTheDocument();
  });

  it("does not render CTA button when actionLabel/onAction are not provided", () => {
    render(<EmptyState />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders CTA button when actionLabel and onAction are provided", () => {
    render(<EmptyState actionLabel="Add story" onAction={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /add story/i })
    ).toBeInTheDocument();
  });

  it("calls onAction when CTA button is clicked", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<EmptyState actionLabel="Add story" onAction={onAction} />);

    await user.click(screen.getByRole("button", { name: /add story/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("accepts a custom icon component", () => {
    render(<EmptyState icon={BookOpen} title="No books" />);
    expect(screen.getByText("No books")).toBeInTheDocument();
  });

  it("does not render CTA if only actionLabel is given without onAction", () => {
    render(<EmptyState actionLabel="Add story" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
