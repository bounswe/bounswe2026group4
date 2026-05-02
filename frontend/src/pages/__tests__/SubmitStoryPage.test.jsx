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
  uploadStoryImage: vi.fn(),
  uploadStoryMedia: vi.fn(),
}));

vi.mock("@/services/tagService", () => ({
  searchTags: vi.fn().mockResolvedValue([]),
  createOrGetTag: vi.fn(),
  getTagStories: vi.fn(),
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

import { createStory, uploadStoryImage, uploadStoryMedia } from "@/services/storyService";
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
    const input = screen.getByLabelText(/images/i);
    fireEvent.change(input, { target: { files: [file] } });

    expect(
      screen.getByText(/only jpg and png images are allowed/i)
    ).toBeInTheDocument();
  });

  it("rejects images larger than 2MB", () => {
    renderPage();

    const bigContent = new Uint8Array(2.5 * 1024 * 1024);
    const file = new File([bigContent], "big.jpg", { type: "image/jpeg" });
    const input = screen.getByLabelText(/images/i);
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
    const input = screen.getByLabelText(/images/i);
    await user.upload(input, file);

    const preview = screen.getByAltText("Preview 1");
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute("src", mockUrl);

    URL.createObjectURL.mockRestore();
  });

  it("shows previews for multiple valid images", async () => {
    const user = userEvent.setup();
    renderPage();

    let callCount = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:fake-${++callCount}`);

    const files = [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.png", { type: "image/png" }),
    ];
    await user.upload(screen.getByLabelText(/images/i), files);

    expect(screen.getByAltText("Preview 1")).toBeInTheDocument();
    expect(screen.getByAltText("Preview 2")).toBeInTheDocument();

    URL.createObjectURL.mockRestore();
  });

  it("caps image selection at 3", async () => {
    const user = userEvent.setup();
    renderPage();

    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:fake");

    const files = [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
      new File(["c"], "c.jpg", { type: "image/jpeg" }),
    ];
    await user.upload(screen.getByLabelText(/images/i), files);

    expect(screen.getByAltText("Preview 1")).toBeInTheDocument();
    expect(screen.getByAltText("Preview 2")).toBeInTheDocument();
    expect(screen.getByAltText("Preview 3")).toBeInTheDocument();

    // Input is disabled once limit is reached
    expect(screen.getByLabelText(/images/i)).toBeDisabled();

    URL.createObjectURL.mockRestore();
  });

  it("shows error when trying to add more than 3 images", async () => {
    const user = userEvent.setup();
    renderPage();

    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:fake");

    const fourFiles = Array.from({ length: 4 }, (_, i) =>
      new File(["x"], `img${i}.jpg`, { type: "image/jpeg" })
    );
    await user.upload(screen.getByLabelText(/images/i), fourFiles);

    expect(screen.getByText(/you can upload at most 3 images/i)).toBeInTheDocument();

    URL.createObjectURL.mockRestore();
  });

  it("removes an image when the remove button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    let callCount = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:fake-${++callCount}`);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const files = [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
    ];
    await user.upload(screen.getByLabelText(/images/i), files);

    expect(screen.getByAltText("Preview 1")).toBeInTheDocument();
    expect(screen.getByAltText("Preview 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove image 1" }));

    // After removing index 0, the remaining image re-indexes to Preview 1
    expect(screen.getAllByAltText(/^Preview \d+$/).length).toBe(1);
    expect(screen.getByAltText("Preview 1")).toBeInTheDocument();

    URL.createObjectURL.mockRestore();
    URL.revokeObjectURL.mockRestore();
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

  it("renders the Add tag button", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /add tag/i })).toBeInTheDocument();
  });

  it("uploads image after story creation when image is selected", async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    createStory.mockResolvedValue({ id: 7 });
    uploadStoryImage.mockResolvedValue({ id: 1, url: "http://example.com/img.jpg" });

    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Story");
    await user.type(screen.getByLabelText(/narrative/i), "A great narrative");
    await user.type(screen.getByLabelText(/place name/i), "Istanbul");
    await user.type(screen.getByLabelText(/^year$/i), "1453");
    await user.click(screen.getByTestId("mock-map-click"));

    const file = new File(["pixels"], "photo.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText(/images/i), file);

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(uploadStoryImage).toHaveBeenCalledWith(7, file);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/stories/7");
    expect(mockToast.success).toHaveBeenCalledWith("Story submitted successfully!");

    URL.createObjectURL.mockRestore();
  });

  it("navigates and shows error toast when image upload fails after story creation", async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    createStory.mockResolvedValue({ id: 8 });
    uploadStoryImage.mockRejectedValue(new Error("Upload failed"));

    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Story");
    await user.type(screen.getByLabelText(/narrative/i), "A great narrative");
    await user.type(screen.getByLabelText(/place name/i), "Istanbul");
    await user.type(screen.getByLabelText(/^year$/i), "1453");
    await user.click(screen.getByTestId("mock-map-click"));

    const file = new File(["pixels"], "photo.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText(/images/i), file);

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/stories/8");
    });
    expect(mockToast.error).toHaveBeenCalledWith(
      "Story saved, but the image could not be uploaded."
    );
    expect(mockToast.success).not.toHaveBeenCalled();

    URL.createObjectURL.mockRestore();
  });

  it("does not call uploadStoryImage when no image is selected", async () => {
    const user = userEvent.setup();
    createStory.mockResolvedValue({ id: 9 });

    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Story");
    await user.type(screen.getByLabelText(/narrative/i), "A great narrative");
    await user.type(screen.getByLabelText(/place name/i), "Istanbul");
    await user.type(screen.getByLabelText(/^year$/i), "1453");
    await user.click(screen.getByTestId("mock-map-click"));

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/stories/9");
    });
    expect(uploadStoryImage).not.toHaveBeenCalled();
  });

  it("renders video and audio file inputs", () => {
    renderPage();
    expect(screen.getByLabelText(/video/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/audio/i)).toBeInTheDocument();
  });

  it("rejects video files that are not MP4 or WebM", () => {
    renderPage();
    const file = new File(["content"], "clip.avi", { type: "video/avi" });
    fireEvent.change(screen.getByLabelText(/video/i), { target: { files: [file] } });
    expect(screen.getByText(/only mp4 and webm videos are allowed/i)).toBeInTheDocument();
  });

  it("rejects videos larger than 50MB", () => {
    renderPage();
    const bigContent = new Uint8Array(51 * 1024 * 1024);
    const file = new File([bigContent], "big.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByLabelText(/video/i), { target: { files: [file] } });
    expect(screen.getByText(/each video must be smaller than 50mb/i)).toBeInTheDocument();
  });

  it("rejects audio files that are not MP3, WAV, or OGG", () => {
    renderPage();
    const file = new File(["content"], "track.flac", { type: "audio/flac" });
    fireEvent.change(screen.getByLabelText(/audio/i), { target: { files: [file] } });
    expect(screen.getByText(/only mp3, wav, and ogg audio files are allowed/i)).toBeInTheDocument();
  });

  it("rejects audio files larger than 10MB", () => {
    renderPage();
    const bigContent = new Uint8Array(11 * 1024 * 1024);
    const file = new File([bigContent], "big.mp3", { type: "audio/mpeg" });
    fireEvent.change(screen.getByLabelText(/audio/i), { target: { files: [file] } });
    expect(screen.getByText(/each audio file must be smaller than 10mb/i)).toBeInTheDocument();
  });

  it("uploads video after story creation when video is selected", async () => {
    const user = userEvent.setup();
    createStory.mockResolvedValue({ id: 10 });
    uploadStoryMedia.mockResolvedValue({});

    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Story");
    await user.type(screen.getByLabelText(/narrative/i), "A great narrative");
    await user.type(screen.getByLabelText(/place name/i), "Istanbul");
    await user.type(screen.getByLabelText(/^year$/i), "1453");
    await user.click(screen.getByTestId("mock-map-click"));

    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });
    await user.upload(screen.getByLabelText(/video/i), file);

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(uploadStoryMedia).toHaveBeenCalledWith(10, file);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/stories/10");
    expect(mockToast.success).toHaveBeenCalledWith("Story submitted successfully!");
  });

  it("uploads audio after story creation when audio is selected", async () => {
    const user = userEvent.setup();
    createStory.mockResolvedValue({ id: 11 });
    uploadStoryMedia.mockResolvedValue({});

    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Story");
    await user.type(screen.getByLabelText(/narrative/i), "A great narrative");
    await user.type(screen.getByLabelText(/place name/i), "Istanbul");
    await user.type(screen.getByLabelText(/^year$/i), "1453");
    await user.click(screen.getByTestId("mock-map-click"));

    const file = new File(["data"], "track.mp3", { type: "audio/mpeg" });
    await user.upload(screen.getByLabelText(/audio/i), file);

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(uploadStoryMedia).toHaveBeenCalledWith(11, file);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/stories/11");
    expect(mockToast.success).toHaveBeenCalledWith("Story submitted successfully!");
  });

  it("shows error toast when video upload fails after story creation", async () => {
    const user = userEvent.setup();
    createStory.mockResolvedValue({ id: 12 });
    uploadStoryMedia.mockRejectedValue(new Error("Upload failed"));

    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Story");
    await user.type(screen.getByLabelText(/narrative/i), "A great narrative");
    await user.type(screen.getByLabelText(/place name/i), "Istanbul");
    await user.type(screen.getByLabelText(/^year$/i), "1453");
    await user.click(screen.getByTestId("mock-map-click"));

    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });
    await user.upload(screen.getByLabelText(/video/i), file);

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/stories/12");
    });
    expect(mockToast.error).toHaveBeenCalledWith("Story saved, but the video could not be uploaded.");
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it("shows error toast when audio upload fails after story creation", async () => {
    const user = userEvent.setup();
    createStory.mockResolvedValue({ id: 13 });
    uploadStoryMedia.mockRejectedValue(new Error("Upload failed"));

    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Story");
    await user.type(screen.getByLabelText(/narrative/i), "A great narrative");
    await user.type(screen.getByLabelText(/place name/i), "Istanbul");
    await user.type(screen.getByLabelText(/^year$/i), "1453");
    await user.click(screen.getByTestId("mock-map-click"));

    const file = new File(["data"], "track.mp3", { type: "audio/mpeg" });
    await user.upload(screen.getByLabelText(/audio/i), file);

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/stories/13");
    });
    expect(mockToast.error).toHaveBeenCalledWith("Story saved, but the audio could not be uploaded.");
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it("shows generic error toast when multiple media uploads fail", async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    createStory.mockResolvedValue({ id: 14 });
    uploadStoryImage.mockRejectedValue(new Error("fail"));
    uploadStoryMedia.mockRejectedValue(new Error("fail"));

    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Story");
    await user.type(screen.getByLabelText(/narrative/i), "A great narrative");
    await user.type(screen.getByLabelText(/place name/i), "Istanbul");
    await user.type(screen.getByLabelText(/^year$/i), "1453");
    await user.click(screen.getByTestId("mock-map-click"));

    await user.upload(screen.getByLabelText(/images/i), new File(["p"], "photo.jpg", { type: "image/jpeg" }));
    await user.upload(screen.getByLabelText(/video/i), new File(["v"], "clip.mp4", { type: "video/mp4" }));

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/stories/14");
    });
    expect(mockToast.error).toHaveBeenCalledWith("Story saved, but some media could not be uploaded.");
    expect(mockToast.success).not.toHaveBeenCalled();

    URL.createObjectURL.mockRestore();
  });

  it("does not call uploadStoryMedia when no video or audio is selected", async () => {
    const user = userEvent.setup();
    createStory.mockResolvedValue({ id: 15 });

    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Story");
    await user.type(screen.getByLabelText(/narrative/i), "A great narrative");
    await user.type(screen.getByLabelText(/place name/i), "Istanbul");
    await user.type(screen.getByLabelText(/^year$/i), "1453");
    await user.click(screen.getByTestId("mock-map-click"));

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/stories/15");
    });
    expect(uploadStoryMedia).not.toHaveBeenCalled();
  });

  it("shows selected video filename after a valid video is added", async () => {
    const user = userEvent.setup();
    renderPage();
    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });
    await user.upload(screen.getByLabelText(/videos/i), file);
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
  });

  it("shows selected audio filename after a valid audio is added", async () => {
    const user = userEvent.setup();
    renderPage();
    const file = new File(["data"], "track.mp3", { type: "audio/mpeg" });
    await user.upload(screen.getByLabelText(/audio/i), file);
    expect(screen.getByText("track.mp3")).toBeInTheDocument();
  });

  it("allows adding multiple videos up to the limit", async () => {
    const user = userEvent.setup();
    renderPage();
    const files = [
      new File(["a"], "v1.mp4", { type: "video/mp4" }),
      new File(["b"], "v2.mp4", { type: "video/mp4" }),
    ];
    await user.upload(screen.getByLabelText(/videos/i), files);
    expect(screen.getByText("v1.mp4")).toBeInTheDocument();
    expect(screen.getByText("v2.mp4")).toBeInTheDocument();
  });

  it("allows adding multiple audios up to the limit", async () => {
    const user = userEvent.setup();
    renderPage();
    const files = [
      new File(["a"], "a1.mp3", { type: "audio/mpeg" }),
      new File(["b"], "a2.mp3", { type: "audio/mpeg" }),
    ];
    await user.upload(screen.getByLabelText(/audio/i), files);
    expect(screen.getByText("a1.mp3")).toBeInTheDocument();
    expect(screen.getByText("a2.mp3")).toBeInTheDocument();
  });

  it("caps video selection at 3 and disables input", async () => {
    const user = userEvent.setup();
    renderPage();
    const files = [
      new File(["a"], "v1.mp4", { type: "video/mp4" }),
      new File(["b"], "v2.mp4", { type: "video/mp4" }),
      new File(["c"], "v3.mp4", { type: "video/mp4" }),
    ];
    const input = screen.getByLabelText(/videos/i, { selector: "input" });
    await user.upload(input, files);
    expect(input).toBeDisabled();
  });

  it("shows error when trying to add more than 3 videos", async () => {
    const user = userEvent.setup();
    renderPage();
    const files = Array.from({ length: 4 }, (_, i) =>
      new File(["x"], `v${i}.mp4`, { type: "video/mp4" })
    );
    await user.upload(screen.getByLabelText(/videos/i), files);
    expect(screen.getByText(/you can upload at most 3 videos/i)).toBeInTheDocument();
  });

  it("caps audio selection at 3 and disables input", async () => {
    const user = userEvent.setup();
    renderPage();
    const files = [
      new File(["a"], "a1.mp3", { type: "audio/mpeg" }),
      new File(["b"], "a2.mp3", { type: "audio/mpeg" }),
      new File(["c"], "a3.mp3", { type: "audio/mpeg" }),
    ];
    const input = screen.getByLabelText(/audio/i, { selector: "input" });
    await user.upload(input, files);
    expect(input).toBeDisabled();
  });

  it("shows error when trying to add more than 3 audio files", async () => {
    const user = userEvent.setup();
    renderPage();
    const files = Array.from({ length: 4 }, (_, i) =>
      new File(["x"], `a${i}.mp3`, { type: "audio/mpeg" })
    );
    await user.upload(screen.getByLabelText(/audio/i), files);
    expect(screen.getByText(/you can upload at most 3 audio files/i)).toBeInTheDocument();
  });

  it("removes a video when the remove button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    const files = [
      new File(["a"], "v1.mp4", { type: "video/mp4" }),
      new File(["b"], "v2.mp4", { type: "video/mp4" }),
    ];
    await user.upload(screen.getByLabelText(/videos/i), files);
    expect(screen.getByText("v1.mp4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove video 1" }));

    expect(screen.queryByText("v1.mp4")).not.toBeInTheDocument();
    expect(screen.getByText("v2.mp4")).toBeInTheDocument();
  });

  it("removes an audio when the remove button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    const files = [
      new File(["a"], "a1.mp3", { type: "audio/mpeg" }),
      new File(["b"], "a2.mp3", { type: "audio/mpeg" }),
    ];
    await user.upload(screen.getByLabelText(/audio/i), files);
    expect(screen.getByText("a1.mp3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove audio 1" }));

    expect(screen.queryByText("a1.mp3")).not.toBeInTheDocument();
    expect(screen.getByText("a2.mp3")).toBeInTheDocument();
  });

  it("uploads all selected videos after story creation", async () => {
    const user = userEvent.setup();
    createStory.mockResolvedValue({ id: 20 });
    uploadStoryMedia.mockResolvedValue({});
    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Story");
    await user.type(screen.getByLabelText(/narrative/i), "A great narrative");
    await user.type(screen.getByLabelText(/place name/i), "Istanbul");
    await user.type(screen.getByLabelText(/^year$/i), "1453");
    await user.click(screen.getByTestId("mock-map-click"));

    const v1 = new File(["a"], "v1.mp4", { type: "video/mp4" });
    const v2 = new File(["b"], "v2.mp4", { type: "video/mp4" });
    await user.upload(screen.getByLabelText(/videos/i), [v1, v2]);

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(uploadStoryMedia).toHaveBeenCalledWith(20, v1);
      expect(uploadStoryMedia).toHaveBeenCalledWith(20, v2);
    });
    expect(mockToast.success).toHaveBeenCalledWith("Story submitted successfully!");
  });

  it("uploads all selected audio files after story creation", async () => {
    const user = userEvent.setup();
    createStory.mockResolvedValue({ id: 21 });
    uploadStoryMedia.mockResolvedValue({});
    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Story");
    await user.type(screen.getByLabelText(/narrative/i), "A great narrative");
    await user.type(screen.getByLabelText(/place name/i), "Istanbul");
    await user.type(screen.getByLabelText(/^year$/i), "1453");
    await user.click(screen.getByTestId("mock-map-click"));

    const a1 = new File(["a"], "a1.mp3", { type: "audio/mpeg" });
    const a2 = new File(["b"], "a2.mp3", { type: "audio/mpeg" });
    await user.upload(screen.getByLabelText(/audio/i), [a1, a2]);

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(uploadStoryMedia).toHaveBeenCalledWith(21, a1);
      expect(uploadStoryMedia).toHaveBeenCalledWith(21, a2);
    });
    expect(mockToast.success).toHaveBeenCalledWith("Story submitted successfully!");
  });

});
