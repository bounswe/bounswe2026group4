import { SITE_URL } from "./constants";

function assignIfDefined(target, key, value) {
  if (value !== null && value !== undefined) {
    target[key] = value;
  }
}

function deriveTemporalCoverage(story) {
  if (story.temporal_coverage_iso8601) return story.temporal_coverage_iso8601;
  const { time_type, year, year_start, year_end } = story;
  switch (time_type) {
    case "exact_year":
    case "approximate_year":
      return year != null ? String(year) : undefined;
    case "decade": {
      if (year == null) return undefined;
      const start = Math.floor(year / 10) * 10;
      return `${start}/${start + 9}`;
    }
    case "year_range":
      return year_start != null && year_end != null
        ? `${year_start}/${year_end}`
        : undefined;
    default:
      return undefined;
  }
}

function buildStoryStructuredData(story) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${SITE_URL}/stories/${story.id}`,
  };

  assignIfDefined(data, "headline", story.title);
  assignIfDefined(data, "articleBody", story.narrative);
  assignIfDefined(data, "datePublished", story.submitted_at);
  assignIfDefined(data, "dateModified", story.updated_at);

  if (story.contributor_name) {
    data.author = { "@type": "Person", name: story.contributor_name };
  }

  if (story.location_name) {
    const place = { "@type": "Place", name: story.location_name };
    const lat = parseFloat(story.location_lat);
    const lng = parseFloat(story.location_lng);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      place.geo = {
        "@type": "GeoCoordinates",
        latitude: lat,
        longitude: lng,
      };
    }
    data.contentLocation = place;
  }

  const temporalCoverage = deriveTemporalCoverage(story);
  assignIfDefined(data, "temporalCoverage", temporalCoverage);

  if (Array.isArray(story.tags) && story.tags.length > 0) {
    data.keywords = story.tags;
  }

  const mediaItems = Array.isArray(story.media_items) ? story.media_items : [];
  const images = mediaItems
    .filter((m) => m.media_type === "image")
    .map((m) => ({ "@type": "ImageObject", contentUrl: m.url }));
  const audio = mediaItems
    .filter((m) => m.media_type === "audio")
    .map((m) => ({ "@type": "AudioObject", contentUrl: m.url }));
  const video = mediaItems
    .filter((m) => m.media_type === "video")
    .map((m) => ({ "@type": "VideoObject", contentUrl: m.url }));

  if (images.length > 0) data.image = images;
  if (audio.length > 0) data.audio = audio;
  if (video.length > 0) data.video = video;

  const interactions = [];
  if (typeof story.like_count === "number") {
    interactions.push({
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/LikeAction",
      userInteractionCount: story.like_count,
    });
  }
  if (typeof story.save_count === "number") {
    interactions.push({
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/BookmarkAction",
      userInteractionCount: story.save_count,
    });
  }
  if (interactions.length > 0) data.interactionStatistic = interactions;

  return data;
}

function buildUserStructuredData(user) {
  const profileUrl = `${SITE_URL}/profile/${user.id}`;
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": profileUrl,
    identifier: user.id,
    url: profileUrl,
  };

  assignIfDefined(data, "name", user.username);
  if (user.bio) data.description = user.bio;
  assignIfDefined(data, "image", user.profile_photo);

  if (user.location) {
    data.address = {
      "@type": "PostalAddress",
      addressLocality: user.location,
    };
  }

  return data;
}

function StructuredData({ story, user }) {
  if (!story && !user) return null;

  const structured = story
    ? buildStoryStructuredData(story)
    : buildUserStructuredData(user);

  const json = JSON.stringify(structured).replace(/<\//g, "<\\/");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

export default StructuredData;
