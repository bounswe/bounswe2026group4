import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";

// Mock MapPicker directly so we can trigger onChange
vi.mock("@/components/MapPicker/MapPicker", () => ({
  default: ({ value, onChange }) => (
    <div data-testid="map-picker">
      <button
        data-testid="mock-map-click"
        type="button"
        onClick={() => onChange({ lat: 41.0082, lng: 28.9784 })}
      >
        Set Location
      </button>
      {value && <span>Selected: {value.lat}, {value.lng}</span>}
    </div>
  ),
}));

vi.mock("@/services/storyService", () => ({
  createStory: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockToast = { success: vi.fn(), error: vi.fn() };
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import { createStory } from "@/services/storyService";
import SubmitStoryPage from "../SubmitStoryPage";

function renderPage() {
  return render(
    <BrowserRouter>
      <SubmitStoryPage />
    </BrowserRouter>
  );
}

describe("SubmitStoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  it("renders all form fields", () => {
    renderPage();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/narrative/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/place name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/time type/i)).toBeInTheDocument();
    expect(screen.getByTestId("map-picker")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit story/i })
    ).toBeInTheDocument();
  });

  it("shows validation errors when submitting empty form", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    expect(screen.getByText(/narrative is required/i)).toBeInTheDocument();
    expect(screen.getByText(/place name is required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/please select a location on the map/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/year is required/i)).toBeInTheDocument();
  });

  it("shows year input for exact_year time type", () => {
    renderPage();
    expect(screen.getByLabelText(/^year$/i)).toBeInTheDocument();
  });

  it("shows year range inputs when year_range is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByLabelText(/time type/i), "year_range");

    expect(screen.getByLabelText(/start year/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end year/i)).toBeInTheDocument();
  });

  it("validates year range - start must be before end", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByLabelText(/time type/i), "year_range");
    await user.type(screen.getByLabelText(/start year/i), "1500");
    await user.type(screen.getByLabelText(/end year/i), "1400");

    await user.click(screen.getByTestId("mock-map-click"));
    await user.type(screen.getByLabelText(/title/i), "My Story");
    await user.type(screen.getByLabelText(/narrative/i), "A narrative");
    await user.type(screen.getByLabelText(/place name/i), "Istanbul");

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    expect(screen.getByText(/start year must be before end year/i)).toBeInTheDocument();
  });

  it("validates year range - both years required", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByLabelText(/time type/i), "year_range");

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    expect(screen.getByText(/start year is required/i)).toBeInTheDocument();
    expect(screen.getByText(/end year is required/i)).toBeInTheDocument();
  });

  it("rejects image files that are not JPG/PNG", () => {
    renderPage();

    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });
    const input = screen.getByLabelText(/image/i);
    fireEvent.change(input, { target: { files: [file] } });

    expect(
      screen.getByText(/only jpg and png images are allowed/i)
    ).toBeInTheDocument();
  });

  it("rejects images larger than 2MB", () => {
    renderPage();

    const bigContent = new Uint8Array(2.5 * 1024 * 1024);
    const file = new File([bigContent], "big.jpg", { type: "image/jpeg" });
    const input = screen.getByLabelText(/image/i);
    fireEvent.change(input, { target: { files: [file] } });

    expect(
      screen.getByText(/image must be smaller than 2mb/i)
    ).toBeInTheDocument();
  });

  it("shows image preview for valid image", async () => {
    const user = userEvent.setup();
    renderPage();

    const mockUrl = "blob:http://localhost/fake-image";
    vi.spyOn(URL, "createObjectURL").mockReturnValue(mockUrl);

    const file = new File(["pixels"], "photo.jpg", { type: "image/jpeg" });
    const input = screen.getByLabelText(/image/i);
    await user.upload(input, file);

    const preview = screen.getByAltText(/preview/i);
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute("src", mockUrl);

    URL.createObjectURL.mockRestore();
  });

  it("submits form successfully and navigates", async () => {
    const user = userEvent.setup();
    createStory.mockResolvedValue({ id: 1 });
    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Story");
    await user.type(screen.getByLabelText(/narrative/i), "A great narrative");
    await user.type(screen.getByLabelText(/place name/i), "Istanbul");
    await user.type(screen.getByLabelText(/^year$/i), "1453");

    // Click mock map to set location
    await user.click(screen.getByTestId("mock-map-click"));

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(createStory).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/stories/1");
    });
    expect(mockToast.success).toHaveBeenCalledWith("Story submitted successfully!");
  });

  it("shows API error message on submission failure", async () => {
    const user = userEvent.setup();
    createStory.mockRejectedValue({
      response: { data: { detail: "Server error" } },
    });
    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Story");
    await user.type(screen.getByLabelText(/narrative/i), "A great narrative");
    await user.type(screen.getByLabelText(/place name/i), "Istanbul");
    await user.type(screen.getByLabelText(/^year$/i), "1453");

    // Click mock map to set location
    await user.click(screen.getByTestId("mock-map-click"));

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });

  it("renders tag checkboxes", () => {
    renderPage();
    expect(screen.getByLabelText(/architecture/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/war/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/culture/i)).toBeInTheDocument();
  });

  it("limits tag selection to 3", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByLabelText(/architecture/i));
    await user.click(screen.getByLabelText(/war/i));
    await user.click(screen.getByLabelText(/culture/i));

    expect(screen.getByLabelText(/trade/i)).toBeDisabled();
  });
});
