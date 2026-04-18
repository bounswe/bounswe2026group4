import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import StructuredData from "../StructuredData";
import { SITE_URL } from "../constants";

function getJsonLd(container) {
  const script = container.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script.innerHTML);
}

function makeStory(overrides = {}) {
  return {
    id: 42,
    user: 7,
    title: "The Ancient Bridge",
    narrative: "Once upon a time there was a bridge.",
    contributor_name: "historian_01",
    location_name: "Old City",
    location_lat: "41.0082",
    location_lng: "28.9784",
    time_type: "exact_year",
    year: 1965,
    year_start: null,
    year_end: null,
    submitted_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-02-01T00:00:00Z",
    like_count: 5,
    save_count: 3,
    media_items: [],
    ...overrides,
  };
}

function makeUser(overrides = {}) {
  return {
    id: 11,
    username: "ada",
    bio: "Historian and writer.",
    location: "Istanbul",
    profile_photo: "https://cdn.example.com/ada.jpg",
    date_joined: "2023-05-01T00:00:00Z",
    published_story_count: 4,
    total_points: 120,
    birth_year: 1990,
    ...overrides,
  };
}

describe("StructuredData", () => {
  it("renders a <script type='application/ld+json'> tag", () => {
    const { container } = render(<StructuredData story={makeStory()} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
  });

  it("returns null when neither story nor user is provided", () => {
    const { container } = render(<StructuredData />);
    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it("escapes </script> sequences in user-supplied content", () => {
    const { container } = render(
      <StructuredData
        story={makeStory({ narrative: "evil </script><script>alert(1)</script>" })}
      />
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script.innerHTML).not.toContain("</script>");
    expect(script.innerHTML).toContain("<\\/script>");
    const data = JSON.parse(script.innerHTML);
    expect(data.articleBody).toBe("evil </script><script>alert(1)</script>");
  });

  describe("story mapping", () => {
    it("includes author.name when contributor_name is present", () => {
      const { container } = render(
        <StructuredData story={makeStory({ contributor_name: "historian_01" })} />
      );
      const data = getJsonLd(container);
      expect(data["@type"]).toBe("Article");
      expect(data.author).toEqual({ "@type": "Person", name: "historian_01" });
    });

    it("omits author entirely when contributor_name is null (anonymous story)", () => {
      const { container } = render(
        <StructuredData story={makeStory({ contributor_name: null })} />
      );
      const data = getJsonLd(container);
      expect("author" in data).toBe(false);
    });

    it("does not emit image/audio/video keys when there are no media items", () => {
      const { container } = render(
        <StructuredData story={makeStory({ media_items: [] })} />
      );
      const data = getJsonLd(container);
      expect("image" in data).toBe(false);
      expect("audio" in data).toBe(false);
      expect("video" in data).toBe(false);
    });

    it("does not emit keywords when tags are absent or empty", () => {
      const noTags = render(<StructuredData story={makeStory()} />);
      expect("keywords" in getJsonLd(noTags.container)).toBe(false);

      const emptyTags = render(<StructuredData story={makeStory({ tags: [] })} />);
      expect("keywords" in getJsonLd(emptyTags.container)).toBe(false);
    });

    it("emits keywords when tags are provided", () => {
      const { container } = render(
        <StructuredData story={makeStory({ tags: ["bridge", "ottoman"] })} />
      );
      const data = getJsonLd(container);
      expect(data.keywords).toEqual(["bridge", "ottoman"]);
    });

    it("splits mixed media items into image/audio/video arrays", () => {
      const media = [
        { id: 1, url: "https://cdn.example.com/a.jpg", media_type: "image", order: 0 },
        { id: 2, url: "https://cdn.example.com/b.mp3", media_type: "audio", order: 1 },
        { id: 3, url: "https://cdn.example.com/c.mp4", media_type: "video", order: 2 },
        { id: 4, url: "https://cdn.example.com/d.jpg", media_type: "image", order: 3 },
      ];
      const { container } = render(
        <StructuredData story={makeStory({ media_items: media })} />
      );
      const data = getJsonLd(container);
      expect(data.image).toEqual([
        { "@type": "ImageObject", contentUrl: "https://cdn.example.com/a.jpg" },
        { "@type": "ImageObject", contentUrl: "https://cdn.example.com/d.jpg" },
      ]);
      expect(data.audio).toEqual([
        { "@type": "AudioObject", contentUrl: "https://cdn.example.com/b.mp3" },
      ]);
      expect(data.video).toEqual([
        { "@type": "VideoObject", contentUrl: "https://cdn.example.com/c.mp4" },
      ]);
    });

    describe("temporal coverage derivation", () => {
      it("exact_year yields the year as a string", () => {
        const { container } = render(
          <StructuredData story={makeStory({ time_type: "exact_year", year: 1965 })} />
        );
        expect(getJsonLd(container).temporalCoverage).toBe("1965");
      });

      it("approximate_year yields the year as a string", () => {
        const { container } = render(
          <StructuredData
            story={makeStory({ time_type: "approximate_year", year: 1870 })}
          />
        );
        expect(getJsonLd(container).temporalCoverage).toBe("1870");
      });

      it("decade yields start/end of the decade", () => {
        const { container } = render(
          <StructuredData story={makeStory({ time_type: "decade", year: 1960 })} />
        );
        expect(getJsonLd(container).temporalCoverage).toBe("1960/1969");
      });

      it("year_range yields start/end", () => {
        const { container } = render(
          <StructuredData
            story={makeStory({
              time_type: "year_range",
              year: null,
              year_start: 1950,
              year_end: 1975,
            })}
          />
        );
        expect(getJsonLd(container).temporalCoverage).toBe("1950/1975");
      });

      it("prefers temporal_coverage_iso8601 from the API over derivation", () => {
        const { container } = render(
          <StructuredData
            story={makeStory({
              time_type: "decade",
              year: 1960,
              temporal_coverage_iso8601: "1961-03",
            })}
          />
        );
        expect(getJsonLd(container).temporalCoverage).toBe("1961-03");
      });
    });
  });

  describe("user mapping", () => {
    it("emits Person with name and the canonical @id", () => {
      const { container } = render(<StructuredData user={makeUser({ id: 11 })} />);
      const data = getJsonLd(container);
      expect(data["@type"]).toBe("Person");
      expect(data.name).toBe("ada");
      expect(data["@id"]).toBe(`${SITE_URL}/profile/11`);
    });

    it("omits name when username is null (privacy)", () => {
      const { container } = render(
        <StructuredData user={makeUser({ username: null })} />
      );
      const data = getJsonLd(container);
      expect("name" in data).toBe(false);
    });
  });
});
