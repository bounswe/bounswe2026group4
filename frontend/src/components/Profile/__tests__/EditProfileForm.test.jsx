import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/services/userService", () => ({
  getOwnProfile: vi.fn(),
  updateProfile: vi.fn(),
  uploadProfilePhoto: vi.fn(),
  removeProfilePhoto: vi.fn(),
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: vi.fn(),
}));

import {
  getOwnProfile,
  updateProfile,
  uploadProfilePhoto,
  removeProfilePhoto,
} from "@/services/userService";
import { useToast } from "@/hooks/useToast";
import EditProfileForm from "../EditProfileForm";

const mockSuccessToast = vi.fn();
const mockErrorToast = vi.fn();

const baseProfileResponse = {
  data: {
    id: 1,
    email: "test@example.com",
    profile: {
      first_name: "Alice",
      last_name: "Smith",
      location: "Istanbul",
      bio: "Hello world",
      birth_date: "1990-05-15",
      is_name_public: true,
      is_location_public: true,
      is_birth_date_public: false,
      is_photo_public: true,
      profile_photo: null,
    },
  },
};

function renderForm(props = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const result = render(
    <EditProfileForm onSave={onSave} onCancel={onCancel} {...props} />
  );
  return { ...result, onSave, onCancel };
}

describe("EditProfileForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToast.mockReturnValue({
      toast: { success: mockSuccessToast, error: mockErrorToast },
    });
    getOwnProfile.mockResolvedValue(baseProfileResponse);
    updateProfile.mockResolvedValue({ success: true });
    uploadProfilePhoto.mockResolvedValue({ photo_url: "http://example.com/photo.jpg" });
    removeProfilePhoto.mockResolvedValue(undefined);
  });

  describe("loading state", () => {
    it("shows loading indicator while fetching own profile", () => {
      getOwnProfile.mockReturnValue(new Promise(() => {}));
      renderForm();
      expect(screen.getByLabelText("Loading profile data")).toBeInTheDocument();
    });

    it("hides loading indicator after fetch resolves", async () => {
      renderForm();
      await waitFor(() =>
        expect(screen.queryByLabelText("Loading profile data")).not.toBeInTheDocument()
      );
    });
  });

  describe("field pre-population", () => {
    it("pre-populates first name and last name from own profile", async () => {
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toHaveValue("Alice")
      );
      expect(screen.getByLabelText("Last name")).toHaveValue("Smith");
    });

    it("pre-populates location and bio", async () => {
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );
      expect(screen.getByLabelText(/^Location$/i)).toHaveValue("Istanbul");
      expect(screen.getByLabelText(/^Bio$/i)).toHaveValue("Hello world");
    });

    it("pre-populates birth date", async () => {
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );
      expect(screen.getByLabelText(/^Birth date$/i)).toHaveValue("1990-05-15");
    });

    it("reflects privacy flags from profile — birth date switch is off (Private)", async () => {
      renderForm();
      await waitFor(() => {
        const toggle = screen.getByRole("switch", { name: /Birth date visibility/i });
        expect(toggle).toHaveAttribute("aria-checked", "false");
      });
    });

    it("handles missing profile gracefully with empty defaults", async () => {
      getOwnProfile.mockResolvedValue({ data: {} });
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toHaveValue("")
      );
    });
  });

  describe("visibility toggles", () => {
    it("location toggle is on (Public) when is_location_public is true", async () => {
      renderForm();
      await waitFor(() => {
        const toggle = screen.getByRole("switch", { name: /Location visibility/i });
        expect(toggle).toHaveAttribute("aria-checked", "true");
      });
    });

    it("toggles location from Public to Private on click", async () => {
      const user = userEvent.setup();
      renderForm();
      await waitFor(() =>
        expect(
          screen.getByRole("switch", { name: /Location visibility/i })
        ).toHaveAttribute("aria-checked", "true")
      );
      await user.click(screen.getByRole("switch", { name: /Location visibility/i }));
      expect(
        screen.getByRole("switch", { name: /Location visibility/i })
      ).toHaveAttribute("aria-checked", "false");
    });

    it("toggles name visibility and sends updated value on save", async () => {
      const user = userEvent.setup();
      renderForm();
      await waitFor(() =>
        expect(
          screen.getByRole("switch", { name: /Name visibility/i })
        ).toHaveAttribute("aria-checked", "true")
      );
      await user.click(screen.getByRole("switch", { name: /Name visibility/i }));
      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      await waitFor(() =>
        expect(updateProfile).toHaveBeenCalledWith(
          {},
          expect.objectContaining({ is_name_public: false })
        )
      );
    });
  });

  describe("photo upload", () => {
    it("shows error for unsupported file type", async () => {
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );

      const input = screen.getByTestId("photo-file-input");
      const gifFile = new File(["gif"], "anim.gif", { type: "image/gif" });
      Object.defineProperty(input, "files", {
        value: [gifFile],
        configurable: true,
      });
      fireEvent.change(input);

      expect(
        await screen.findByText("Only JPG and PNG files are allowed.")
      ).toBeInTheDocument();
    });

    it("shows error when file exceeds 2 MB", async () => {
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );

      const input = screen.getByTestId("photo-file-input");
      const bigFile = new File(
        ["x".repeat(3 * 1024 * 1024)],
        "huge.jpg",
        { type: "image/jpeg" }
      );
      Object.defineProperty(input, "files", {
        value: [bigFile],
        configurable: true,
      });
      fireEvent.change(input);

      expect(
        await screen.findByText("Photo must be 2 MB or smaller.")
      ).toBeInTheDocument();
    });

    it("shows preview image when a valid file is selected", async () => {
      const previewUrl = "blob:http://localhost/fake-photo";
      vi.stubGlobal("URL", {
        createObjectURL: vi.fn(() => previewUrl),
        revokeObjectURL: vi.fn(),
      });

      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );

      const input = screen.getByTestId("photo-file-input");
      const jpgFile = new File(["img"], "photo.jpg", { type: "image/jpeg" });
      Object.defineProperty(input, "files", {
        value: [jpgFile],
        configurable: true,
      });
      fireEvent.change(input);

      const preview = await screen.findByAltText("Profile preview");
      expect(preview).toHaveAttribute("src", previewUrl);

      vi.unstubAllGlobals();
    });

    it("clears preview when Remove photo is clicked", async () => {
      getOwnProfile.mockResolvedValue({
        data: {
          profile: {
            ...baseProfileResponse.data.profile,
            profile_photo: "http://example.com/existing.jpg",
          },
        },
      });

      const user = userEvent.setup();
      renderForm();
      await waitFor(() =>
        expect(screen.getByAltText("Profile preview")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("button", { name: /Remove photo/i }));
      expect(screen.queryByAltText("Profile preview")).not.toBeInTheDocument();
    });
  });

  describe("bio", () => {
    it("displays character counter", async () => {
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );
      // "Hello world" is 11 chars
      expect(screen.getByText("11/500")).toBeInTheDocument();
    });

    it("updates counter as user types", async () => {
      const user = userEvent.setup();
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );

      const bioField = screen.getByLabelText(/^Bio$/i);
      await user.clear(bioField);
      await user.type(bioField, "Hi");
      expect(screen.getByText("2/500")).toBeInTheDocument();
    });

    it("shows validation error on submit when bio exceeds 500 chars", async () => {
      const user = userEvent.setup();
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );

      const bioField = screen.getByLabelText(/^Bio$/i);
      fireEvent.change(bioField, { target: { value: "a".repeat(501) } });

      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      expect(
        await screen.findByText(/Bio must be 500 characters or fewer/i)
      ).toBeInTheDocument();
      expect(updateProfile).not.toHaveBeenCalled();
    });
  });

  describe("birth date validation", () => {
    it("shows error when birth date is in the future", async () => {
      const user = userEvent.setup();
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );

      const birthDateInput = screen.getByLabelText(/^Birth date$/i);
      fireEvent.change(birthDateInput, { target: { value: "2099-01-01" } });

      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      expect(
        await screen.findByText(/Birth date cannot be in the future/i)
      ).toBeInTheDocument();
      expect(updateProfile).not.toHaveBeenCalled();
    });

    it("shows error when birth date is before 1900", async () => {
      const user = userEvent.setup();
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );

      const birthDateInput = screen.getByLabelText(/^Birth date$/i);
      fireEvent.change(birthDateInput, { target: { value: "1899-12-31" } });

      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      expect(
        await screen.findByText(/Birth date cannot be before 1900/i)
      ).toBeInTheDocument();
    });
  });

  describe("cancel", () => {
    it("calls onCancel when Cancel button is clicked", async () => {
      const user = userEvent.setup();
      const { onCancel } = renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("button", { name: /Cancel/i }));
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe("save flow", () => {
    it("sends all profile fields to updateProfile", async () => {
      const user = userEvent.setup();
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      await waitFor(() =>
        expect(updateProfile).toHaveBeenCalledWith(
          {},
          expect.objectContaining({
            first_name: "Alice",
            last_name: "Smith",
            location: "Istanbul",
            bio: "Hello world",
            birth_date: "1990-05-15",
            is_name_public: true,
            is_location_public: true,
            is_birth_date_public: false,
            is_photo_public: true,
          })
        )
      );
    });

    it("calls uploadProfilePhoto before updateProfile when new photo selected", async () => {
      const previewUrl = "blob:http://localhost/fake";
      vi.stubGlobal("URL", {
        createObjectURL: vi.fn(() => previewUrl),
        revokeObjectURL: vi.fn(),
      });

      const user = userEvent.setup();
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );

      const input = screen.getByTestId("photo-file-input");
      const jpgFile = new File(["img"], "photo.jpg", { type: "image/jpeg" });
      Object.defineProperty(input, "files", {
        value: [jpgFile],
        configurable: true,
      });
      fireEvent.change(input);

      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      await waitFor(() => expect(updateProfile).toHaveBeenCalled());
      expect(uploadProfilePhoto).toHaveBeenCalledWith(jpgFile);
      expect(uploadProfilePhoto.mock.invocationCallOrder[0]).toBeLessThan(
        updateProfile.mock.invocationCallOrder[0]
      );

      vi.unstubAllGlobals();
    });

    it("calls removeProfilePhoto before updateProfile when photo removed", async () => {
      getOwnProfile.mockResolvedValue({
        data: {
          profile: {
            ...baseProfileResponse.data.profile,
            profile_photo: "http://example.com/photo.jpg",
          },
        },
      });

      const user = userEvent.setup();
      renderForm();
      await waitFor(() =>
        expect(screen.getByAltText("Profile preview")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("button", { name: /Remove photo/i }));
      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      await waitFor(() => expect(updateProfile).toHaveBeenCalled());
      expect(removeProfilePhoto).toHaveBeenCalled();
      expect(removeProfilePhoto.mock.invocationCallOrder[0]).toBeLessThan(
        updateProfile.mock.invocationCallOrder[0]
      );
    });

    it("does not call uploadProfilePhoto or removeProfilePhoto when photo unchanged", async () => {
      const user = userEvent.setup();
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      await waitFor(() => expect(updateProfile).toHaveBeenCalled());
      expect(uploadProfilePhoto).not.toHaveBeenCalled();
      expect(removeProfilePhoto).not.toHaveBeenCalled();
    });

    it("shows success toast and calls onSave after successful save", async () => {
      const user = userEvent.setup();
      const { onSave } = renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      await waitFor(() => {
        expect(mockSuccessToast).toHaveBeenCalledWith("Profile updated successfully.");
        expect(onSave).toHaveBeenCalledOnce();
      });
    });

    it("shows error toast when updateProfile fails", async () => {
      updateProfile.mockRejectedValue(new Error("Server error"));

      const user = userEvent.setup();
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      await waitFor(() =>
        expect(mockErrorToast).toHaveBeenCalledWith("Server error")
      );
    });

    it("disables Cancel during save", async () => {
      let resolveUpdate;
      updateProfile.mockReturnValue(
        new Promise((res) => {
          resolveUpdate = res;
        })
      );

      const user = userEvent.setup();
      renderForm();
      await waitFor(() =>
        expect(screen.getByLabelText("First name")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      expect(screen.getByRole("button", { name: /Cancel/i })).toBeDisabled();

      resolveUpdate({ success: true });
    });
  });
});
