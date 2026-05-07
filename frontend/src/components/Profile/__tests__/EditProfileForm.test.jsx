import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/services/userService", () => ({
  updateProfile: vi.fn(),
  uploadProfilePhoto: vi.fn(),
  removeProfilePhoto: vi.fn(),
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

import {
  updateProfile,
  uploadProfilePhoto,
  removeProfilePhoto,
} from "@/services/userService";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import EditProfileForm from "../EditProfileForm";

const mockSuccessToast = vi.fn();
const mockErrorToast = vi.fn();
const mockUpdateUser = vi.fn();

const baseProfileResponse = {
  id: 1,
  username: "alice_smith",
  email: "test@example.com",
  is_username_public: true,
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
};

function renderForm(props = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const result = render(
    <EditProfileForm
      initialProfile={baseProfileResponse}
      onSave={onSave}
      onCancel={onCancel}
      {...props}
    />
  );
  return { ...result, onSave, onCancel };
}

describe("EditProfileForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToast.mockReturnValue({
      toast: { success: mockSuccessToast, error: mockErrorToast },
    });
    useAuth.mockReturnValue({ updateUser: mockUpdateUser });
    updateProfile.mockResolvedValue({ success: true, data: baseProfileResponse });
    uploadProfilePhoto.mockResolvedValue({ photo_url: "http://example.com/photo.jpg" });
    removeProfilePhoto.mockResolvedValue(undefined);
  });

  describe("field pre-population", () => {
    it("pre-populates username", () => {
      renderForm();
      expect(screen.getByLabelText("Username")).toHaveValue("alice_smith");
    });

    it("pre-populates first name and last name from own profile", () => {
      renderForm();
      expect(screen.getByLabelText("First name")).toHaveValue("Alice");
      expect(screen.getByLabelText("Last name")).toHaveValue("Smith");
    });

    it("pre-populates location and bio", () => {
      renderForm();
      expect(screen.getByLabelText(/^Location$/i)).toHaveValue("Istanbul");
      expect(screen.getByLabelText(/^Bio$/i)).toHaveValue("Hello world");
    });

    it("pre-populates birth date", () => {
      renderForm();
      expect(screen.getByLabelText(/^Birth date$/i)).toHaveValue("1990-05-15");
    });

    it("reflects privacy flags from profile - birth date switch is off (Private)", () => {
      renderForm();
      const toggle = screen.getByRole("switch", { name: /Birth date visibility/i });
      expect(toggle).toHaveAttribute("aria-checked", "false");
    });

    it("handles missing profile gracefully with empty defaults", () => {
      renderForm({ initialProfile: {} });
      expect(screen.getByLabelText("First name")).toHaveValue("");
    });
  });

  describe("visibility toggles", () => {
    it("location toggle is on (Public) when is_location_public is true", () => {
      renderForm();
      const toggle = screen.getByRole("switch", { name: /Location visibility/i });
      expect(toggle).toHaveAttribute("aria-checked", "true");
    });

    it("toggles location from Public to Private on click", async () => {
      const user = userEvent.setup();
      renderForm();
      await user.click(screen.getByRole("switch", { name: /Location visibility/i }));
      expect(
        screen.getByRole("switch", { name: /Location visibility/i })
      ).toHaveAttribute("aria-checked", "false");
    });

    it("toggles name visibility and sends updated value on save", async () => {
      const user = userEvent.setup();
      renderForm();
      await user.click(screen.getByRole("switch", { name: /^Name visibility$/i }));
      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      await waitFor(() =>
        expect(updateProfile).toHaveBeenCalledWith(
          expect.objectContaining({ username: "alice_smith" }),
          expect.objectContaining({ is_name_public: false })
        )
      );
    });
  });

  describe("photo upload", () => {
    it("shows error for unsupported file type", async () => {
      renderForm();
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
      const user = userEvent.setup();
      renderForm({
        initialProfile: {
          ...baseProfileResponse,
          profile: {
            ...baseProfileResponse.profile,
            profile_photo: "http://example.com/existing.jpg",
          },
        },
      });
      await waitFor(() =>
        expect(screen.getByAltText("Profile preview")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("button", { name: /Remove photo/i }));
      expect(screen.queryByAltText("Profile preview")).not.toBeInTheDocument();
    });
  });

  describe("bio", () => {
    it("displays character counter", () => {
      renderForm();
      // "Hello world" is 11 chars
      expect(screen.getByText("11/500")).toBeInTheDocument();
    });

    it("updates counter as user types", async () => {
      const user = userEvent.setup();
      renderForm();
      const bioField = screen.getByLabelText(/^Bio$/i);
      await user.clear(bioField);
      await user.type(bioField, "Hi");
      expect(screen.getByText("2/500")).toBeInTheDocument();
    });

    it("shows validation error on submit when bio exceeds 500 chars", async () => {
      const user = userEvent.setup();
      renderForm();
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
      await user.click(screen.getByRole("button", { name: /Cancel/i }));
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe("private profile toggle", () => {
    it("renders the username visibility toggle switch", () => {
      renderForm();
      expect(screen.getByRole("switch", { name: /Username visibility/i })).toBeInTheDocument();
    });

    it("toggle shows Public when is_username_public is true", () => {
      renderForm();
      const toggle = screen.getByRole("switch", { name: /Username visibility/i });
      // VisibilityToggle: checked=true means Public, aria-checked="true"
      expect(toggle).toHaveAttribute("aria-checked", "true");
    });

    it("toggle shows Private when is_username_public is false", () => {
      renderForm({
        initialProfile: { ...baseProfileResponse, is_username_public: false },
      });
      const toggle = screen.getByRole("switch", { name: /Username visibility/i });
      // VisibilityToggle: checked=false means Private, aria-checked="false"
      expect(toggle).toHaveAttribute("aria-checked", "false");
    });

    it("clicking the toggle flips it from Public to Private", async () => {
      const user = userEvent.setup();
      renderForm();
      const toggle = screen.getByRole("switch", { name: /Username visibility/i });
      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-checked", "false");
    });

    it("clicking the toggle twice returns it to Public", async () => {
      const user = userEvent.setup();
      renderForm();
      const toggle = screen.getByRole("switch", { name: /Username visibility/i });
      await user.click(toggle);
      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-checked", "true");
    });

    it("sends is_username_public: false when private profile is enabled on save", async () => {
      const user = userEvent.setup();
      renderForm();
      await user.click(screen.getByRole("switch", { name: /Username visibility/i }));
      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      await waitFor(() =>
        expect(updateProfile).toHaveBeenCalledWith(
          expect.objectContaining({ is_username_public: false }),
          expect.any(Object)
        )
      );
    });

    it("sends is_username_public: true when private profile is disabled on save", async () => {
      const user = userEvent.setup();
      renderForm({
        initialProfile: { ...baseProfileResponse, is_username_public: false },
      });
      await user.click(screen.getByRole("switch", { name: /Username visibility/i }));
      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      await waitFor(() =>
        expect(updateProfile).toHaveBeenCalledWith(
          expect.objectContaining({ is_username_public: true }),
          expect.any(Object)
        )
      );
    });

    it("shows helper text indicating identity is hidden when private", async () => {
      const user = userEvent.setup();
      renderForm();
      await user.click(screen.getByRole("switch", { name: /Username visibility/i }));
      expect(screen.getByText(/you appear as anonymous/i)).toBeInTheDocument();
    });

    it("shows helper text indicating identity is visible when public", () => {
      renderForm();
      expect(screen.getByText(/your username is shown on stories/i)).toBeInTheDocument();
    });
  });

  describe("username validation", () => {
    it("shows error and blocks save when username is empty", async () => {
      const user = userEvent.setup();
      renderForm();
      await user.clear(screen.getByLabelText("Username"));
      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      expect(await screen.findByText("Username is required.")).toBeInTheDocument();
      expect(updateProfile).not.toHaveBeenCalled();
    });

    it("clears username error when user starts typing", async () => {
      const user = userEvent.setup();
      renderForm();
      await user.clear(screen.getByLabelText("Username"));
      await user.click(screen.getByRole("button", { name: /Save changes/i }));
      expect(await screen.findByText("Username is required.")).toBeInTheDocument();

      await user.type(screen.getByLabelText("Username"), "x");
      expect(screen.queryByText("Username is required.")).not.toBeInTheDocument();
    });
  });

  describe("save flow", () => {
    it("sends all profile fields to updateProfile", async () => {
      const user = userEvent.setup();
      renderForm();
      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      await waitFor(() =>
        expect(updateProfile).toHaveBeenCalledWith(
          expect.objectContaining({ username: "alice_smith", is_username_public: true }),
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
      const user = userEvent.setup();
      renderForm({
        initialProfile: {
          ...baseProfileResponse,
          profile: {
            ...baseProfileResponse.profile,
            profile_photo: "http://example.com/photo.jpg",
          },
        },
      });
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
      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      await waitFor(() => expect(updateProfile).toHaveBeenCalled());
      expect(uploadProfilePhoto).not.toHaveBeenCalled();
      expect(removeProfilePhoto).not.toHaveBeenCalled();
    });

    it("shows success toast and calls onSave after successful save", async () => {
      const user = userEvent.setup();
      const { onSave } = renderForm();
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
      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      await waitFor(() =>
        expect(mockErrorToast).toHaveBeenCalledWith("Server error")
      );
    });

    it("calls updateUser with the updateProfile response data after successful save", async () => {
      const user = userEvent.setup();
      renderForm();
      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith(baseProfileResponse);
      });
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
      await user.click(screen.getByRole("button", { name: /Save changes/i }));

      expect(screen.getByRole("button", { name: /Cancel/i })).toBeDisabled();

      resolveUpdate({ success: true });
    });
  });
});
