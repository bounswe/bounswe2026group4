import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEffect } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import StoryDetailPage from "../StoryDetailPage";

vi.mock("@/services/storyService", () => ({
  getStoryById: vi.fn(),
  deleteStory: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ user: null })),
}));

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/hooks/useToast", () => ({
  useToast: vi.fn(() => ({ toast: mockToast, dismiss: vi.fn() })),
}));

vi.mock("@/components/StoryDetailMap/StoryDetailMap", () => ({
  default: ({ lat, lng }) => (
    <div data-testid="story-detail-map" data-lat={lat} data-lng={lng} />
  ),
}));

vi.mock("@/components/Interactions/LikeButton", () => ({
  default: ({ storyId, initialLiked, initialCount }) => (
    <div
      data-testid="like-button"
      data-story-id={storyId}
      data-liked={String(initialLiked)}
      data-count={initialCount}
    />
  ),
}));

vi.mock("@/components/Interactions/BookmarkButton", () => ({
  default: ({ storyId, initialBookmarked }) => (
    <button
      data-testid="bookmark-button"
      data-story-id={storyId}
      aria-label={initialBookmarked ? "Remove bookmark" : "Save story"}
      aria-pressed={String(initialBookmarked)}
    />
  ),
}));

function MockCommentSection({ storyId, onCountChange, onUserCommentedChange }) {
  useEffect(() => {
    onCountChange?.(3);
    onUserCommentedChange?.(false);
  }, [onCountChange, onUserCommentedChange]);
  return <div data-testid="comment-section" data-story-id={storyId} />;
}

vi.mock("@/components/Interactions/CommentSection", () => ({
  default: MockCommentSection,
}));

vi.mock("@/components/Report/ReportModal", () => ({
  default: ({ isOpen, targetType, targetId }) =>
    isOpen ? (
      <div
        data-testid="report-modal"
        data-target-type={targetType}
        data-target-id={String(targetId)}
      />
    ) : null,
}));

import { getStoryById, deleteStory } from "@/services/storyService";
import { useAuth } from "@/hooks/useAuth";

function makeStory(overrides = {}) {
  return {
    id: 1,
    user: 1,
    title: "The Great Fire of Beyoglu",
    narrative: "In the early hours of morning, flames spread through the district.\n\nResidents fled with what little they could carry.",
    location_name: "Beyoglu, Istanbul",
    time_type: "exact_year",
    year: 1870,
    year_start: null,
    year_end: null,
    submitted_at: "2025-06-15T10:00:00Z",
    contributor_name: "historian",
    like_count: 5,
    ...overrides,
  };
}

function renderPage(id = "1", locationState = undefined) {
  const initialEntry = locationState
    ? { pathname: `/stories/${id}`, state: locationState }
    : `/stories/${id}`;
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/stories/:id" element={<StoryDetailPage />} />
        <Route path="/" element={<div>Feed Page</div>} />
        <Route path="/map" element={<div>Map Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("StoryDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: null });
  });

  it("shows loading skeleton while fetching", () => {
    getStoryById.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByLabelText("Loading story")).toBeInTheDocument();
  });

  it("renders story title after successful fetch", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });
  });

  it("renders location name", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Beyoglu, Istanbul")).toBeInTheDocument();
    });
  });

  it("renders formatted time period", async () => {
    getStoryById.mockResolvedValue(makeStory({ time_type: "exact_year", year: 1870 }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("1870")).toBeInTheDocument();
    });
  });

  it("renders submitted date with 'Date added' label", async () => {
    getStoryById.mockResolvedValue(makeStory({ submitted_at: "2025-06-15T10:00:00Z" }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/date added:.*june 15, 2025/i)).toBeInTheDocument();
    });
  });

  it("renders each narrative paragraph separately", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/In the early hours of morning/)).toBeInTheDocument();
      expect(screen.getByText(/Residents fled with what little/)).toBeInTheDocument();
    });
  });

  it("shows not-found state on 404 response", async () => {
    const err = { response: { status: 404 } };
    getStoryById.mockRejectedValue(err);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Story not found")).toBeInTheDocument();
    });
  });

  it("shows error state on non-404 API failure", async () => {
    getStoryById.mockRejectedValue(new Error("Network error"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("shows API error detail message when provided", async () => {
    const err = { response: { status: 500, data: { detail: "Server exploded" } } };
    getStoryById.mockRejectedValue(err);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Server exploded")).toBeInTheDocument();
    });
  });

  it("retry button re-fetches the story after error", async () => {
    const user = userEvent.setup();
    getStoryById
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue(makeStory());

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(getStoryById).toHaveBeenCalledTimes(2);
  });

  it("stories link is present in loaded state", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /stories/i })).toBeInTheDocument();
  });

  it("stories link is present in not-found state", async () => {
    getStoryById.mockRejectedValue({ response: { status: 404 } });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Story not found")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /stories/i })).toBeInTheDocument();
  });

  it("stories link is present in error state", async () => {
    getStoryById.mockRejectedValue(new Error("fail"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /stories/i })).toBeInTheDocument();
  });

  it("renders contributor name as a link to their profile", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      const link = screen.getByRole("link", { name: "historian" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/profile/1");
    });
  });

  it("omits contributor name when absent", async () => {
    getStoryById.mockResolvedValue(makeStory({ contributor_name: null }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("link", { name: "historian" })).not.toBeInTheDocument();
  });

  it("renders images from media_items when present", async () => {
    getStoryById.mockResolvedValue(makeStory({
      media_items: [
        { id: 10, url: "http://example.com/img1.jpg", media_type: "image", order: 0 },
      ],
    }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Story image 1" })).toBeInTheDocument();
    });
  });

  it("does not render image section when media_items are absent", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Story images")).not.toBeInTheDocument();
  });

  it("renders image, video, and audio sections when all media types present", async () => {
    getStoryById.mockResolvedValue(makeStory({
      media_items: [
        { id: 1, url: "http://example.com/img.jpg", media_type: "image", order: 0 },
        { id: 2, url: "http://example.com/vid.mp4", media_type: "video", order: 1 },
        { id: 3, url: "http://example.com/aud.mp3", media_type: "audio", order: 2 },
      ],
    }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Story images")).toBeInTheDocument();
    });

    expect(screen.getByRole("img", { name: "Story image 1" })).toHaveAttribute("src", "http://example.com/img.jpg");
    expect(screen.getByLabelText("Story video 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Story audio 1")).toBeInTheDocument();
  });

  it("renders video player for stories with video attachments", async () => {
    getStoryById.mockResolvedValue(makeStory({
      media_items: [
        { id: 5, url: "http://example.com/clip.mp4", media_type: "video", order: 0 },
      ],
    }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Story videos")).toBeInTheDocument();
    });

    const video = screen.getByLabelText("Story video 1");
    expect(video.tagName).toBe("VIDEO");
    expect(video).toHaveAttribute("src", "http://example.com/clip.mp4");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("preload", "auto");
  });

  it("renders audio player for stories with audio attachments", async () => {
    getStoryById.mockResolvedValue(makeStory({
      media_items: [
        { id: 6, url: "http://example.com/track.mp3", media_type: "audio", order: 0 },
      ],
    }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Story audio")).toBeInTheDocument();
    });

    const audio = screen.getByLabelText("Story audio 1");
    expect(audio.tagName).toBe("AUDIO");
    expect(audio).toHaveAttribute("src", "http://example.com/track.mp3");
    expect(audio).toHaveAttribute("controls");
  });

  it("renders multiple video items", async () => {
    getStoryById.mockResolvedValue(makeStory({
      media_items: [
        { id: 7, url: "http://example.com/v1.mp4", media_type: "video", order: 0 },
        { id: 8, url: "http://example.com/v2.mp4", media_type: "video", order: 1 },
        { id: 9, url: "http://example.com/v3.mp4", media_type: "video", order: 2 },
      ],
    }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Story video 1")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Story video 1")).toHaveAttribute("src", "http://example.com/v1.mp4");
    expect(screen.getByLabelText("Story video 2")).toHaveAttribute("src", "http://example.com/v2.mp4");
    expect(screen.getByLabelText("Story video 3")).toHaveAttribute("src", "http://example.com/v3.mp4");
  });

  it("renders multiple audio items", async () => {
    getStoryById.mockResolvedValue(makeStory({
      media_items: [
        { id: 10, url: "http://example.com/a1.mp3", media_type: "audio", order: 0 },
        { id: 11, url: "http://example.com/a2.mp3", media_type: "audio", order: 1 },
      ],
    }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Story audio 1")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Story audio 1")).toHaveAttribute("src", "http://example.com/a1.mp3");
    expect(screen.getByLabelText("Story audio 2")).toHaveAttribute("src", "http://example.com/a2.mp3");
  });

  it("renders media sections in order: images then videos then audio", async () => {
    getStoryById.mockResolvedValue(makeStory({
      media_items: [
        { id: 1, url: "img.jpg", media_type: "image", order: 0 },
        { id: 2, url: "vid.mp4", media_type: "video", order: 1 },
        { id: 3, url: "aud.mp3", media_type: "audio", order: 2 },
      ],
    }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Story images")).toBeInTheDocument();
    });

    const imagesSection = screen.getByLabelText("Story images");
    const videosSection = screen.getByLabelText("Story videos");
    const audioSection = screen.getByLabelText("Story audio");

    expect(imagesSection.compareDocumentPosition(videosSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(videosSection.compareDocumentPosition(audioSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("does not render video section when no video media items", async () => {
    getStoryById.mockResolvedValue(makeStory({
      media_items: [
        { id: 1, url: "img.jpg", media_type: "image", order: 0 },
      ],
    }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Story videos")).not.toBeInTheDocument();
  });

  it("does not render audio section when no audio media items", async () => {
    getStoryById.mockResolvedValue(makeStory({
      media_items: [
        { id: 1, url: "img.jpg", media_type: "image", order: 0 },
      ],
    }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Story audio")).not.toBeInTheDocument();
  });

  it("shows fallback when video fails to load", async () => {
    getStoryById.mockResolvedValue(makeStory({
      media_items: [
        { id: 20, url: "http://example.com/bad.mp4", media_type: "video", order: 0 },
      ],
    }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Story video 1")).toBeInTheDocument();
    });

    fireEvent.error(screen.getByLabelText("Story video 1"));

    await waitFor(() => {
      expect(screen.queryByLabelText("Story video 1")).not.toBeInTheDocument();
      expect(screen.getByText("Video could not be loaded")).toBeInTheDocument();
    });
  });

  it("shows fallback when audio fails to load", async () => {
    getStoryById.mockResolvedValue(makeStory({
      media_items: [
        { id: 21, url: "http://example.com/bad.mp3", media_type: "audio", order: 0 },
      ],
    }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Story audio 1")).toBeInTheDocument();
    });

    fireEvent.error(screen.getByLabelText("Story audio 1"));

    await waitFor(() => {
      expect(screen.queryByLabelText("Story audio 1")).not.toBeInTheDocument();
      expect(screen.getByText("Audio could not be loaded")).toBeInTheDocument();
    });
  });

  it("shows fallback when image fails to load", async () => {
    getStoryById.mockResolvedValue(makeStory({
      media_items: [
        { id: 22, url: "http://example.com/bad.jpg", media_type: "image", order: 0 },
      ],
    }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Story image 1" })).toBeInTheDocument();
    });

    fireEvent.error(screen.getByRole("img", { name: "Story image 1" }));

    await waitFor(() => {
      expect(screen.queryByRole("img", { name: "Story image 1" })).not.toBeInTheDocument();
      expect(screen.getByText("Image could not be loaded")).toBeInTheDocument();
    });
  });

  it("renders map when coordinates are present", async () => {
    getStoryById.mockResolvedValue(makeStory({ location_lat: "41.0082", location_lng: "28.9784" }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("story-detail-map")).toBeInTheDocument();
    });

    expect(screen.getByTestId("story-detail-map")).toHaveAttribute("data-lat", "41.0082");
    expect(screen.getByTestId("story-detail-map")).toHaveAttribute("data-lng", "28.9784");
  });

  it("does not render map when coordinates are absent", async () => {
    getStoryById.mockResolvedValue(makeStory({ location_lat: null, location_lng: null }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(screen.queryByTestId("story-detail-map")).not.toBeInTheDocument();
  });

  it("omits location when location_name is absent", async () => {
    getStoryById.mockResolvedValue(makeStory({ location_name: null }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(screen.queryByText("Beyoglu, Istanbul")).not.toBeInTheDocument();
  });

  it("omits date when submitted_at is absent", async () => {
    getStoryById.mockResolvedValue(makeStory({ submitted_at: null }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(screen.queryByText(/date added/i)).not.toBeInTheDocument();
  });

  it("calls getStoryById with the correct id from the URL", async () => {
    getStoryById.mockResolvedValue(makeStory({ id: 42 }));
    renderPage("42");

    await waitFor(() => {
      expect(getStoryById).toHaveBeenCalledWith("42");
    });
  });

  it("renders decade time period correctly", async () => {
    getStoryById.mockResolvedValue(makeStory({ time_type: "decade", year: 1870 }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("1870s")).toBeInTheDocument();
    });
  });

  it("renders LikeButton with story like data", async () => {
    getStoryById.mockResolvedValue(makeStory({ like_count: 7, user_has_liked: true }));
    renderPage();

    await waitFor(() => {
      const btn = screen.getByTestId("like-button");
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute("data-story-id", "1");
      expect(btn).toHaveAttribute("data-liked", "true");
      expect(btn).toHaveAttribute("data-count", "7");
    });
  });

  it("renders comment count from CommentSection next to like button", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument(); // count reported by mock
    });
  });

  it("renders CommentSection with story id", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      const section = screen.getByTestId("comment-section");
      expect(section).toBeInTheDocument();
      expect(section).toHaveAttribute("data-story-id", "1");
    });
  });

  it("renders year range time period correctly", async () => {
    getStoryById.mockResolvedValue(makeStory({ time_type: "year_range", year_start: 1860, year_end: 1880 }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("1860\u20131880")).toBeInTheDocument();
    });
  });

  it("back button navigates to map when navigated from map view", async () => {
    const user = userEvent.setup();
    getStoryById.mockResolvedValue(makeStory());
    renderPage("1", { from: "/map" });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /stories/i }));

    expect(screen.getByText("Map Page")).toBeInTheDocument();
  });

  it("back button navigates to feed when no from state", async () => {
    const user = userEvent.setup();
    getStoryById.mockResolvedValue(makeStory());

    // Seed history so navigate(-1) has an entry to go back to
    render(
      <MemoryRouter initialEntries={["/", "/stories/1"]} initialIndex={1}>
        <Routes>
          <Route path="/stories/:id" element={<StoryDetailPage />} />
          <Route path="/" element={<div>Feed Page</div>} />
          <Route path="/map" element={<div>Map Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /stories/i }));

    expect(screen.getByText("Feed Page")).toBeInTheDocument();
  });

  describe("delete story", () => {
    it("does not show delete button when user is not authenticated", async () => {
      useAuth.mockReturnValue({ user: null });
      getStoryById.mockResolvedValue(makeStory());
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
      });

      expect(screen.queryByRole("button", { name: "Delete story" })).not.toBeInTheDocument();
    });

    it("does not show delete button when user is not the owner or admin", async () => {
      useAuth.mockReturnValue({ user: { id: 999, role: "registered_user" } });
      getStoryById.mockResolvedValue(makeStory({ user: 1 }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
      });

      expect(screen.queryByRole("button", { name: "Delete story" })).not.toBeInTheDocument();
    });

    it("shows delete button when user is the story owner", async () => {
      useAuth.mockReturnValue({ user: { id: 1, role: "registered_user" } });
      getStoryById.mockResolvedValue(makeStory({ user: 1 }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: "Delete story" })).toBeInTheDocument();
    });

    it("shows delete button when user is admin", async () => {
      useAuth.mockReturnValue({ user: { id: 999, role: "admin" } });
      getStoryById.mockResolvedValue(makeStory());
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: "Delete story" })).toBeInTheDocument();
    });

    it("does not delete when confirmation is cancelled", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: { id: 1, role: "registered_user" } });
      getStoryById.mockResolvedValue(makeStory({ user: 1 }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Delete story" }));

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(deleteStory).not.toHaveBeenCalled();
    });

    it("deletes story and navigates to feed on success", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: { id: 1, role: "registered_user" } });
      getStoryById.mockResolvedValue(makeStory({ user: 1 }));
      deleteStory.mockResolvedValue(undefined);
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Delete story" }));

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        expect(deleteStory).toHaveBeenCalledWith("1");
      });

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith("Story deleted successfully");
      });

      await waitFor(() => {
        expect(screen.getByText("Feed Page")).toBeInTheDocument();
      });
    });

    it("shows error toast on delete failure", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: { id: 1, role: "registered_user" } });
      getStoryById.mockResolvedValue(makeStory({ user: 1 }));
      deleteStory.mockRejectedValue({ response: { data: { detail: "Permission denied" } } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Delete story" }));

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Permission denied");
      });
    });
  });

  describe("report button", () => {
    it("renders the Flag button for unauthenticated visitors and navigates to /login on click", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: null });
      getStoryById.mockResolvedValue(makeStory());
      renderPage();

      await waitFor(() => screen.getByRole("heading", { name: "The Great Fire of Beyoglu" }));
      const flag = screen.getByRole("button", { name: /report story/i });

      await user.click(flag);

      expect(await screen.findByText("Login Page")).toBeInTheDocument();
      expect(screen.queryByTestId("report-modal")).not.toBeInTheDocument();
    });

    it("renders the Flag button for authenticated users", async () => {
      useAuth.mockReturnValue({ user: { id: 2, role: "registered_user" } });
      getStoryById.mockResolvedValue(makeStory({ user: 1 }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /report story/i })).toBeInTheDocument();
      });
    });

    it("does not render the Flag button on the current user's own story", async () => {
      useAuth.mockReturnValue({ user: { id: 1, role: "registered_user" } });
      getStoryById.mockResolvedValue(makeStory({ user: 1 }));
      renderPage();

      await waitFor(() => screen.getByRole("heading", { name: "The Great Fire of Beyoglu" }));
      expect(screen.queryByRole("button", { name: /report story/i })).not.toBeInTheDocument();
    });

    it("opens the report modal with the story id when Flag is clicked", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: { id: 2, role: "registered_user" } });
      getStoryById.mockResolvedValue(makeStory({ id: 77, user: 1 }));
      renderPage("77");

      await waitFor(() => screen.getByRole("button", { name: /report story/i }));
      expect(screen.queryByTestId("report-modal")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /report story/i }));

      const modal = screen.getByTestId("report-modal");
      expect(modal).toHaveAttribute("data-target-type", "story");
      expect(modal).toHaveAttribute("data-target-id", "77");
    });
  });
});
