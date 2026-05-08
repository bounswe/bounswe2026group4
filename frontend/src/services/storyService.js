import api from "./api";

const PAGE_SIZE = 12;

/**
 * Fetch stories for the feed view.
 * When `q` is provided, uses the /stories/search/ endpoint (title + location search).
 * Otherwise uses /stories/feed/ with optional year and location filters.
 */
function applyProximityParams(params, latitude, longitude, radiusKm) {
  if (latitude != null && longitude != null && radiusKm != null) {
    params.latitude = latitude;
    params.longitude = longitude;
    params.radius_km = radiusKm;
  }
}

export async function getStories({
  q,
  yearFrom,
  yearTo,
  location,
  latMin,
  latMax,
  lngMin,
  lngMax,
  latitude,
  longitude,
  radiusKm,
  tags = [],
  page = 1,
  pageSize = PAGE_SIZE,
  sortBy = "recent",
} = {}) {
  const hasBbox = latMin != null && latMax != null && lngMin != null && lngMax != null;

  if (q?.trim()) {
    const params = { q: q.trim(), page, page_size: pageSize };
    if (yearFrom) params.year_from = yearFrom;
    if (yearTo) params.year_to = yearTo;
    if (hasBbox) {
      params.lat_min = latMin;
      params.lat_max = latMax;
      params.lng_min = lngMin;
      params.lng_max = lngMax;
    } else if (location?.trim()) {
      params.location = location.trim();
    }
    applyProximityParams(params, latitude, longitude, radiusKm);
    if (tags.length > 0) params.tags = tags;
    const response = await api.get("/stories/search/", { params });
    return response.data; // { count, next, previous, results }
  }

  const params = { page, page_size: pageSize, sort_by: sortBy };
  if (yearFrom) params.year_from = yearFrom;
  if (yearTo) params.year_to = yearTo;
  if (hasBbox) {
    params.lat_min = latMin;
    params.lat_max = latMax;
    params.lng_min = lngMin;
    params.lng_max = lngMax;
  } else if (location?.trim()) {
    params.location = location.trim();
  }
  applyProximityParams(params, latitude, longitude, radiusKm);
  if (tags.length > 0) params.tags = tags;

  const response = await api.get("/stories/feed/", { params });
  return response.data; // { count, next, previous, results }
}

export const EMPTY_FEATURE_COLLECTION = Object.freeze({
  type: "FeatureCollection",
  features: [],
});

export const MAP_SEARCH_CAP = 100;

function storyToFeature(story) {
  return {
    type: "Feature",
    id: story.id,
    geometry: {
      type: "Point",
      coordinates: [Number(story.location_lng), Number(story.location_lat)],
    },
    properties: {
      title: story.title,
      location_name: story.location_name,
      time_type: story.time_type,
      year: story.year,
      year_start: story.year_start,
      year_end: story.year_end,
    },
  };
}

/**
 * Fetch story pins for the map view as a GeoJSON FeatureCollection (RFC 7946).
 *
 * - Without `q`: calls /stories/map/ which already returns a FeatureCollection.
 * - With `q`: calls /stories/search/ and adapts paginated results into a
 *   FeatureCollection on the client, since the search endpoint still returns
 *   the legacy paginated story list.
 */
export async function getMapStories({ q, yearFrom, yearTo, location, latMin, latMax, lngMin, lngMax, latitude, longitude, radiusKm, tags = [] } = {}) {
  const hasBbox = latMin != null && latMax != null && lngMin != null && lngMax != null;
  if (q?.trim()) {
    // Hard cap — pins beyond MAP_SEARCH_CAP are silently dropped.
    const params = { q: q.trim(), page_size: MAP_SEARCH_CAP };
    if (yearFrom) params.year_from = yearFrom;
    if (yearTo) params.year_to = yearTo;
    if (hasBbox) {
      params.lat_min = latMin;
      params.lat_max = latMax;
      params.lng_min = lngMin;
      params.lng_max = lngMax;
    } else if (location?.trim()) {
      params.location = location.trim();
    }
    applyProximityParams(params, latitude, longitude, radiusKm);
    if (tags.length > 0) params.tags = tags;
    const response = await api.get("/stories/search/", { params });
    const features = response.data.results
      .filter((s) => s.location_lat != null && s.location_lng != null)
      .map(storyToFeature);
    return {
      type: "FeatureCollection",
      features,
      totalCount: response.data.count,
    };
  }

  const params = {};
  if (yearFrom) params.year_from = yearFrom;
  if (yearTo) params.year_to = yearTo;
  if (hasBbox) {
    params.lat_min = latMin;
    params.lat_max = latMax;
    params.lng_min = lngMin;
    params.lng_max = lngMax;
  } else if (location?.trim()) {
    params.location = location.trim();
  }
  applyProximityParams(params, latitude, longitude, radiusKm);
  if (tags.length > 0) params.tags = tags;

  const response = await api.get("/stories/map/", { params });
  const fc = response.data ?? EMPTY_FEATURE_COLLECTION;
  return { ...fc, totalCount: fc.features?.length ?? 0 };
}

export async function createStory(formData) {
  const response = await api.post("/stories/", formData);
  return response.data;
}

export async function getStoryById(id) {
  const response = await api.get(`/stories/${id}/`);
  return response.data;
}

export async function deleteStory(id) {
  await api.delete(`/stories/${id}/`);
}

export async function uploadStoryImage(storyId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post(`/stories/${storyId}/images/`, formData);
  return response.data.image;
}

export async function uploadStoryMedia(storyId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post(`/stories/${storyId}/media/`, formData);
  return response.data;
}

export async function getUserStories(userId, { page = 1, pageSize = 10 } = {}) {
  const response = await api.get(`/users/${userId}/stories/`, {
    params: { page, page_size: pageSize },
  });
  return response.data; // { count, next, previous, results }
}
