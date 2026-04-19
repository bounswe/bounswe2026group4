import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ProfileCompletionPage from "../ProfileCompletionPage";
import { ToastProvider } from "@/context/ToastContext";
import { Toaster } from "@/components/ui/toaster";

vi.mock("@/services/userService", () => ({
  updateCurrentUser: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import { updateCurrentUser } from "@/services/userService";

function renderPage({ initialEntries = ["/complete-profile"] } = {}) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <ProfileCompletionPage />
      </MemoryRouter>
      <Toaster />
    </ToastProvider>
  );
}

function renderPageWithFrom(from, { search = "", hash = "" } = {}) {
  return render(
    <ToastProvider>
      <MemoryRouter
        initialEntries={[{
          pathname: "/complete-profile",
          state: { from: { pathname: from, search, hash, state: null, key: "testkey" } },
        }]}
      >
        <ProfileCompletionPage />
      </MemoryRouter>
      <Toaster />
    </ToastProvider>
  );
}

describe("ProfileCompletionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Renders correctly
  it("renders all form fields", () => {
    renderPage();

    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^surname/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/upload profile photo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^location$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^birth date$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^bio$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /complete profile/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /skip for now/i })).toBeInTheDocument();
  });

  it("renders all privacy toggles", () => {
    renderPage();

    expect(screen.getByLabelText(/show name publicly/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/show username publicly/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/show location publicly/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/show birth date publicly/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/show profile photo publicly/i)).toBeInTheDocument();
  });

  it("shows the page title and description", () => {
    renderPage();

    expect(screen.getByText("Local History Story Map")).toBeInTheDocument();
    expect(screen.getByText(/complete your profile/i)).toBeInTheDocument();
  });

  // 2. Required field validation
  it("shows errors when required fields are empty on submit", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(await screen.findByText("Surname is required.")).toBeInTheDocument();
    expect(updateCurrentUser).not.toHaveBeenCalled();
  });

  it("shows error when name is empty", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(updateCurrentUser).not.toHaveBeenCalled();
  });

  it("shows error when surname is empty", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    expect(await screen.findByText(/surname is required/i)).toBeInTheDocument();
    expect(updateCurrentUser).not.toHaveBeenCalled();
  });

  // 3. Optional field validation
  it("shows error when location exceeds 255 characters", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    await user.type(screen.getByLabelText(/^location$/i), "a".repeat(256));
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    expect(await screen.findByText(/cannot exceed 255 characters/i)).toBeInTheDocument();
    expect(updateCurrentUser).not.toHaveBeenCalled();
  });

  it("accepts a valid birth date", async () => {
    const user = userEvent.setup();
    updateCurrentUser.mockResolvedValue({ success: true, data: {} });
    renderPage();

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    fireEvent.change(screen.getByLabelText(/^birth date$/i), { target: { value: "1990-05-20" } });
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    await waitFor(() => {
      expect(updateCurrentUser).toHaveBeenCalled();
    });
  });

  // 4. Photo upload validation
  it("shows error when a non-image file is uploaded", async () => {
    renderPage();

    const fileInput = screen.getByLabelText(/upload profile photo/i);
    const nonImageFile = new File(["text"], "document.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [nonImageFile] } });

    expect(await screen.findByText(/valid image file/i)).toBeInTheDocument();
  });

  it("accepts a valid image file upload", async () => {
    renderPage();

    const fileInput = screen.getByLabelText(/upload profile photo/i);
    const imageFile = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [imageFile] } });

    expect(await screen.findByText("photo.jpg")).toBeInTheDocument();
    expect(screen.queryByText(/valid image file/i)).not.toBeInTheDocument();
  });

  it("shows photo preview after valid image upload", async () => {
    renderPage();

    const fileInput = screen.getByLabelText(/upload profile photo/i);
    const imageFile = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [imageFile] } });

    expect(await screen.findByAltText("Profile preview")).toBeInTheDocument();
  });

  it("remove photo button is not shown before a photo is selected", () => {
    renderPage();

    expect(screen.queryByRole("button", { name: /remove photo/i })).not.toBeInTheDocument();
  });

  it("remove photo button appears after a photo is selected", async () => {
    renderPage();

    const fileInput = screen.getByLabelText(/upload profile photo/i);
    const imageFile = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [imageFile] } });

    expect(await screen.findByRole("button", { name: /remove photo/i })).toBeInTheDocument();
  });

  it("clicking remove photo clears the preview, filename, and remove button", async () => {
    const user = userEvent.setup();
    renderPage();

    const fileInput = screen.getByLabelText(/upload profile photo/i);
    const imageFile = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [imageFile] } });
    expect(await screen.findByAltText("Profile preview")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove photo/i }));

    expect(screen.queryByAltText("Profile preview")).not.toBeInTheDocument();
    expect(screen.queryByText("photo.jpg")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove photo/i })).not.toBeInTheDocument();
  });

  it("submits without a photo after removing the selected file", async () => {
    const user = userEvent.setup();
    updateCurrentUser.mockResolvedValue({ success: true, data: {} });
    renderPage();

    const fileInput = screen.getByLabelText(/upload profile photo/i);
    const imageFile = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [imageFile] } });
    await screen.findByRole("button", { name: /remove photo/i });
    await user.click(screen.getByRole("button", { name: /remove photo/i }));

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    await waitFor(() => {
      expect(updateCurrentUser).toHaveBeenCalledWith(
        expect.objectContaining({ profilePhoto: undefined })
      );
    });
  });

  // 5. Successful submission with only required fields
  it("calls updateCurrentUser with required fields only", async () => {
    const user = userEvent.setup();
    updateCurrentUser.mockResolvedValue({ success: true, data: {} });
    renderPage();

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    await waitFor(() => {
      expect(updateCurrentUser).toHaveBeenCalledWith({
        profile: expect.objectContaining({
          first_name: "John",
          last_name: "Smith",
        }),
        userFields: expect.objectContaining({
          is_username_public: true,
        }),
        profilePhoto: undefined,
      });
    });
  });

  it("navigates to home after successful submission with no 'from' state", async () => {
    const user = userEvent.setup();
    updateCurrentUser.mockResolvedValue({ success: true, data: {} });
    renderPage();

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("navigates to original destination after successful submission when 'from' state exists", async () => {
    const user = userEvent.setup();
    updateCurrentUser.mockResolvedValue({ success: true, data: {} });
    renderPageWithFrom("/submit-story");

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        { pathname: "/submit-story", search: "", hash: "" },
        { replace: true }
      );
    });
  });

  it("shows success toast on profile completion", async () => {
    const user = userEvent.setup();
    updateCurrentUser.mockResolvedValue({ success: true, data: {} });
    renderPage();

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    expect(await screen.findByText(/profile completed/i)).toBeInTheDocument();
  });

  // 6. Successful submission with all optional fields
  it("includes optional fields when provided", async () => {
    const user = userEvent.setup();
    updateCurrentUser.mockResolvedValue({ success: true, data: {} });
    renderPage();

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    await user.type(screen.getByLabelText(/^location$/i), "Istanbul");
    await user.type(screen.getByLabelText(/^bio$/i), "A history lover");
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    await waitFor(() => {
      expect(updateCurrentUser).toHaveBeenCalledWith({
        profile: expect.objectContaining({
          first_name: "John",
          last_name: "Smith",
          location: "Istanbul",
          bio: "A history lover",
        }),
        userFields: expect.any(Object),
        profilePhoto: undefined,
      });
    });
  });

  it("includes profile photo in payload when a valid image is uploaded", async () => {
    const user = userEvent.setup();
    updateCurrentUser.mockResolvedValue({ success: true, data: {} });
    renderPage();

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    const fileInput = screen.getByLabelText(/upload profile photo/i);
    const imageFile = new File(["img"], "avatar.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [imageFile] } });
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    await waitFor(() => {
      expect(updateCurrentUser).toHaveBeenCalledWith({
        profile: expect.any(Object),
        userFields: expect.any(Object),
        profilePhoto: imageFile,
      });
    });
  });

  // 7. Privacy settings
  it("sends is_name_public in profile payload", async () => {
    const user = userEvent.setup();
    updateCurrentUser.mockResolvedValue({ success: true, data: {} });
    renderPage();

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    await user.click(screen.getByLabelText(/show name publicly/i));
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    await waitFor(() => {
      expect(updateCurrentUser).toHaveBeenCalledWith({
        profile: expect.objectContaining({ is_name_public: false }),
        userFields: expect.any(Object),
        profilePhoto: undefined,
      });
    });
  });

  it("sends is_username_public in userFields payload", async () => {
    const user = userEvent.setup();
    updateCurrentUser.mockResolvedValue({ success: true, data: {} });
    renderPage();

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    await user.click(screen.getByLabelText(/show username publicly/i));
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    await waitFor(() => {
      expect(updateCurrentUser).toHaveBeenCalledWith({
        profile: expect.any(Object),
        userFields: expect.objectContaining({ is_username_public: false }),
        profilePhoto: undefined,
      });
    });
  });

  it("sends is_location_public in profile payload when toggled off", async () => {
    const user = userEvent.setup();
    updateCurrentUser.mockResolvedValue({ success: true, data: {} });
    renderPage();

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    await user.click(screen.getByLabelText(/show location publicly/i));
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    await waitFor(() => {
      expect(updateCurrentUser).toHaveBeenCalledWith({
        profile: expect.objectContaining({ is_location_public: false }),
        userFields: expect.any(Object),
        profilePhoto: undefined,
      });
    });
  });

  // 8. API error handling
  it("shows generic API error on failure", async () => {
    const user = userEvent.setup();
    const error = new Error("Server error");
    error.response = { data: { detail: "An unexpected error occurred." } };
    updateCurrentUser.mockRejectedValue(error);
    renderPage();

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(await screen.findByText(/an unexpected error occurred/i)).toBeInTheDocument();
  });

  it("shows backend field errors for profile fields", async () => {
    const user = userEvent.setup();
    const error = new Error("Bad request");
    error.response = {
      data: {
        errors: {
          profile: {
            first_name: ["This field is required."],
          },
        },
      },
    };
    updateCurrentUser.mockRejectedValue(error);
    renderPage();

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    expect(await screen.findByText(/this field is required/i)).toBeInTheDocument();
  });

  // 9. Loading state
  it("shows loading state and disables button during submission", async () => {
    const user = userEvent.setup();
    updateCurrentUser.mockReturnValue(new Promise(() => {}));
    renderPage();

    await user.type(screen.getByLabelText(/^name/i), "John");
    await user.type(screen.getByLabelText(/^surname/i), "Smith");
    await user.click(screen.getByRole("button", { name: /complete profile/i }));

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /saving profile/i });
      expect(button).toBeDisabled();
    });
  });

  // 10. Field errors clear on input
  it("clears name error when user starts typing", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /complete profile/i }));
    expect(await screen.findByText("Name is required.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^name/i), "J");
    expect(screen.queryByText("Name is required.")).not.toBeInTheDocument();
  });

  it("clears surname error when user starts typing", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /complete profile/i }));
    expect(await screen.findByText("Surname is required.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^surname/i), "S");
    expect(screen.queryByText("Surname is required.")).not.toBeInTheDocument();
  });

  // 11. Skip for now link
  it("skip link points to home when no 'from' state", () => {
    renderPage();

    const link = screen.getByRole("link", { name: /skip for now/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("skip link points to original destination when 'from' state exists", () => {
    renderPageWithFrom("/submit-story");

    const link = screen.getByRole("link", { name: /skip for now/i });
    expect(link).toHaveAttribute("href", "/submit-story");
  });
});
