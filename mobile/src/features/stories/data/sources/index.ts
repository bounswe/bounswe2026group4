import { apiClient } from '../../../../core/api/client';
import { StoryEntity } from '../../domain/entities';
import { StoryFilters } from '../../domain/repositories';

const storiesFixture: StoryEntity[] = [];
type StoryRecord = Record<string, unknown>;
type StoryMapFeatureRecord = {
  id?: unknown;
  properties?: unknown;
};
type GeoJSONFeatureCollection = {
  type: 'FeatureCollection';
  features: unknown[];
};
const MAP_PAGE_SIZE = 100;
const GEOJSON_ACCEPT_HEADER = 'application/geo+json, application/json';
const EMPTY_FEATURE_COLLECTION: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

export const storiesRemoteSource = {
  async getStory(id: string) {
    try {
      return (await apiClient.get(`/stories/${id}/`)) ?? storiesFixture.find((story) => story.id === id) ?? null;
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;

      if (status === 404) {
        return null;
      }

      throw error;
    }
  },

  async getStoryComments(id: string) {
    return (await apiClient.get<{ results?: unknown[] }>(`/stories/${id}/comments/`))?.results ?? [];
  },

  async deleteStory(id: string) {
    await apiClient.delete(`/stories/${id}/`);
  },

  async getStories(filters: StoryFilters = {}) {
    return storiesLocalSource.getStories(filters);
  },

  async getStoriesFromApi(filters: StoryFilters = {}) {
    if (!filters.q?.trim()) {
      const results =
        (
          await apiClient.get<{ results?: unknown[] }>(
          `/stories/feed/${buildQueryString({
            page: 1,
            page_size: MAP_PAGE_SIZE,
            sort_by: 'recent',
            ...normalizeStoryFilters(filters),
          })}`,
          )
        )?.results ?? [];

      return filterRemoteStories(results, filters);
    }

    const results = await fetchAllPages('/stories/search/', {
      q: filters.q.trim(),
      page_size: MAP_PAGE_SIZE,
      ...normalizeStoryFilters({ ...filters, q: undefined }),
    });

    return filterRemoteStories(results, filters);
  },

  async getMapFeatureCollectionFromApi(filters: StoryFilters = {}) {
    if (!filters.q?.trim()) {
      const response = await apiClient.get<GeoJSONFeatureCollection | { results?: unknown[] }>(
        `/stories/map/${buildQueryString({
          ...normalizeStoryFilters(filters),
        })}`,
        {
          headers: {
            Accept: GEOJSON_ACCEPT_HEADER,
          },
        },
      );

      const featureCollection = filterFeatureCollectionByBounds(
        normalizeMapFeatureCollection(response),
        filters,
      );

      if (!featureCollection.features.length || featureCollectionHasPreviewText(featureCollection)) {
        return featureCollection;
      }

      const stories = await fetchAllPages('/stories/feed/', {
        page_size: MAP_PAGE_SIZE,
        sort_by: 'recent',
        ...normalizeStoryFilters(filters),
      });

      return attachPreviewTextToFeatureCollection(featureCollection, stories);
    }

    const results = await fetchAllPages('/stories/search/', {
      q: filters.q.trim(),
      page_size: MAP_PAGE_SIZE,
      ...normalizeStoryFilters({ ...filters, q: undefined }),
    });

    return {
      type: 'FeatureCollection',
      features: filterRemoteStories(results, filters)
        .filter(hasCoordinates)
        .map(storyToFeature),
    };
  },
};

export const storiesLocalSource = {
  getStories(filters: StoryFilters = {}) {
    return storiesFixture.filter((story) => {
      if (filters.q?.trim()) {
        const query = filters.q.trim().toLowerCase();
        const searchableText = [story.title, story.location.name].join(' ').toLowerCase();

        if (!searchableText.includes(query)) {
          return false;
        }
      }

      if (filters.tags?.length) {
        const normalizedTags = (story.tags ?? []).map((tag) => tag.toLowerCase());

        if (!filters.tags.every((tag) => normalizedTags.includes(tag.toLowerCase()))) {
          return false;
        }
      }

      if (filters.locationBounds) {
        const latitude = story.location.latitude;
        const longitude = story.location.longitude;
        const isWithinBounds =
          latitude >= filters.locationBounds.latMin &&
          latitude <= filters.locationBounds.latMax &&
          longitude >= filters.locationBounds.lngMin &&
          longitude <= filters.locationBounds.lngMax;

        if (!isWithinBounds) {
          return false;
        }
      } else if (filters.location?.trim()) {
        const normalizedLocation = filters.location.trim().toLowerCase();
        if (!story.location.name.toLowerCase().includes(normalizedLocation)) {
          return false;
        }
      }

      const proximity = getProximityFilter(filters);

      if (
        proximity &&
        haversineKm(
          proximity.latitude,
          proximity.longitude,
          story.location.latitude,
          story.location.longitude,
        ) > proximity.radiusKm
      ) {
        return false;
      }

      if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
        const years = extractYearsFromString(story.timePeriod);
        const minYear = years.length ? Math.min(...years) : undefined;
        const maxYear = years.length ? Math.max(...years) : undefined;

        if (filters.yearFrom !== undefined && maxYear !== undefined && maxYear < filters.yearFrom) {
          return false;
        }

        if (filters.yearTo !== undefined && minYear !== undefined && minYear > filters.yearTo) {
          return false;
        }
      }

      return true;
    });
  },
};

async function fetchAllPages(
  path: string,
  params: Record<string, string | number | undefined>,
) {
  const results: unknown[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const response =
      (await apiClient.get<{ next?: string | null; results?: unknown[] }>(
        `${path}${buildQueryString({ ...params, page })}`,
      )) ?? {};

    results.push(...(response.results ?? []));
    hasNext = Boolean(response.next);
    page += 1;
  }

  return results;
}

function filterRemoteStories(results: unknown[], filters: StoryFilters) {
  return results.filter((value) => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const story = value as StoryRecord;
    const placeName = asString(story.location_name).toLowerCase();
    const title = asString(story.title).toLowerCase();
    const tags = getTagNames(story);

    if (filters.q?.trim()) {
      const query = filters.q.trim().toLowerCase();

      if (!title.includes(query) && !placeName.includes(query)) {
        return false;
      }
    }

    if (filters.tags && filters.tags.length > 1 && tags.length) {
      const normalizedTags = tags.map((tag) => tag.toLowerCase());

      if (!filters.tags.every((tag) => normalizedTags.includes(tag.toLowerCase()))) {
        return false;
      }
    }

    if (filters.locationBounds) {
      const latitude = asNumber(story.location_lat);
      const longitude = asNumber(story.location_lng);
      const isWithinBounds =
        latitude !== undefined &&
        longitude !== undefined &&
        latitude >= filters.locationBounds.latMin &&
        latitude <= filters.locationBounds.latMax &&
        longitude >= filters.locationBounds.lngMin &&
        longitude <= filters.locationBounds.lngMax;

      if (!isWithinBounds) {
        return false;
      }
    } else if (filters.location?.trim()) {
      const location = filters.location.trim().toLowerCase();

      if (!placeName.includes(location)) {
        return false;
      }
    }

    const proximity = getProximityFilter(filters);

    if (proximity && !isRecordWithinRadius(story, proximity)) {
      return false;
    }

    if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
      const years = extractYearsFromRemoteStory(story);
      const minYear = years.length ? Math.min(...years) : undefined;
      const maxYear = years.length ? Math.max(...years) : undefined;

      if (filters.yearFrom !== undefined && maxYear !== undefined && maxYear < filters.yearFrom) {
        return false;
      }

      if (filters.yearTo !== undefined && minYear !== undefined && minYear > filters.yearTo) {
        return false;
      }
    }

    return true;
  });
}

function hasCoordinates(value: unknown) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const story = value as StoryRecord;
  return asNumber(story.location_lat) !== undefined && asNumber(story.location_lng) !== undefined;
}

function storyToFeature(value: unknown) {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid story map feature payload.');
  }

  const story = value as StoryRecord;
  const id = typeof story.id === 'string' || typeof story.id === 'number' ? story.id : undefined;
  const latitude = asNumber(story.location_lat);
  const longitude = asNumber(story.location_lng);

  if (id === undefined || latitude === undefined || longitude === undefined || !asString(story.title)) {
    throw new Error('Invalid story map feature payload.');
  }

  return {
    type: 'Feature',
    id,
    geometry: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
    properties: {
      title: asString(story.title),
      location_name: asString(story.location_name),
      time_type: story.time_type,
      year: story.year,
      year_start: story.year_start,
      year_end: story.year_end,
      preview_text: asString(story.preview_text),
      tags: Array.isArray(story.tags) ? story.tags : Array.isArray(story.tag_names) ? story.tag_names : undefined,
    },
  };
}

function normalizeMapFeatureCollection(
  response: GeoJSONFeatureCollection | { results?: unknown[] } | null,
): GeoJSONFeatureCollection {
  if (!response) {
    return EMPTY_FEATURE_COLLECTION;
  }

  if (isGeoJSONFeatureCollection(response)) {
    return {
      type: 'FeatureCollection',
      features: response.features,
    };
  }

  if (isLegacyMapResponse(response)) {
    return {
      type: 'FeatureCollection',
      features: response.results.filter(hasCoordinates).map(storyToFeature),
    };
  }

  throw new Error('Invalid map response payload.');
}

function attachPreviewTextToFeatureCollection(
  featureCollection: GeoJSONFeatureCollection,
  stories: unknown[],
): GeoJSONFeatureCollection {
  const previewTextById = new Map<string, string>();

  stories.forEach((value) => {
    if (!value || typeof value !== 'object') {
      return;
    }

    const story = value as StoryRecord;
    const id =
      typeof story.id === 'string' || typeof story.id === 'number' ? String(story.id) : undefined;
    const previewText = asString(story.preview_text);

    if (!id || !previewText) {
      return;
    }

    previewTextById.set(id, previewText);
  });

  return {
    type: 'FeatureCollection',
    features: featureCollection.features.map((value) => {
      if (!value || typeof value !== 'object') {
        return value;
      }

      const feature = value as StoryMapFeatureRecord;
      const featureId =
        typeof feature.id === 'string' || typeof feature.id === 'number' ? String(feature.id) : undefined;
      const properties =
        feature.properties && typeof feature.properties === 'object'
          ? (feature.properties as Record<string, unknown>)
          : undefined;
      const previewText = featureId ? previewTextById.get(featureId) : undefined;

      if (!properties || !previewText || asString(properties.preview_text)) {
        return value;
      }

      return {
        ...feature,
        properties: {
          ...properties,
          preview_text: previewText,
        },
      };
    }),
  };
}

function filterFeatureCollectionByBounds(
  featureCollection: GeoJSONFeatureCollection,
  filters: StoryFilters,
): GeoJSONFeatureCollection {
  const bounds = filters.locationBounds;
  const proximity = getProximityFilter(filters);

  if (!bounds && !proximity) {
    return featureCollection;
  }

  return {
    type: 'FeatureCollection',
    features: featureCollection.features.filter((value) => {
      if (!value || typeof value !== 'object') {
        return false;
      }

      const geometry = (value as { geometry?: unknown }).geometry;

      if (!geometry || typeof geometry !== 'object') {
        return false;
      }

      const coordinates = (geometry as { coordinates?: unknown }).coordinates;

      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        return false;
      }

      const longitude = asNumber(coordinates[0]);
      const latitude = asNumber(coordinates[1]);

      if (latitude === undefined || longitude === undefined) {
        return false;
      }

      if (proximity && haversineKm(proximity.latitude, proximity.longitude, latitude, longitude) > proximity.radiusKm) {
        return false;
      }

      return bounds
        ? latitude >= bounds.latMin &&
            latitude <= bounds.latMax &&
            longitude >= bounds.lngMin &&
            longitude <= bounds.lngMax
        : true;
    }),
  };
}

function normalizeStoryFilters(filters: StoryFilters) {
  const params: Record<string, string | number> = {};

  if (filters.q?.trim()) {
    params.q = filters.q.trim();
  }

  if (filters.yearFrom !== undefined) {
    params.year_from = filters.yearFrom;
  }

  if (filters.yearTo !== undefined) {
    params.year_to = filters.yearTo;
  }

  if (filters.locationBounds) {
    params.lat_min = filters.locationBounds.latMin;
    params.lat_max = filters.locationBounds.latMax;
    params.lng_min = filters.locationBounds.lngMin;
    params.lng_max = filters.locationBounds.lngMax;
  } else if (filters.location?.trim()) {
    params.location = filters.location.trim();
  }

  if (filters.tags?.length) {
    params.tag = filters.tags[0];
  }

  const proximity = getProximityFilter(filters);

  if (proximity) {
    params.latitude = proximity.latitude;
    params.longitude = proximity.longitude;
    params.radius_km = proximity.radiusKm;
  }

  if (filters.tags?.length) {
    params.tag = filters.tags[0];
  }

  return params;
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const query = searchParams.toString();

  return query ? `?${query}` : '';
}

function extractYearsFromRemoteStory(story: StoryRecord) {
  const years = [asNumber(story.year), asNumber(story.year_start), asNumber(story.year_end)].filter(
    (value): value is number => value !== undefined,
  );

  if (years.length > 0) {
    return years;
  }

  return extractYearsFromString(asString(story.timePeriod) || asString(story.time_period));
}

function extractYearsFromString(value: string) {
  return (value.match(/-?\d{1,4}/g) ?? [])
    .map((year) => Number(year))
    .filter((year) => Number.isFinite(year));
}

function getTagNames(story: StoryRecord) {
  const rawTags = Array.isArray(story.tags)
    ? story.tags
    : Array.isArray(story.tag_names)
      ? story.tag_names
      : [];

  return rawTags
    .map((tag) => {
      if (typeof tag === 'string') {
        return tag.trim();
      }

      if (tag && typeof tag === 'object') {
        const tagRecord = tag as Record<string, unknown>;

        if (typeof tagRecord.name === 'string') {
          return tagRecord.name.trim();
        }

        if (typeof tagRecord.label === 'string') {
          return tagRecord.label.trim();
        }

        if (typeof tagRecord.slug === 'string') {
          return tagRecord.slug.trim();
        }
      }

      return '';
    })
    .filter((tag): tag is string => Boolean(tag));
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function isGeoJSONFeatureCollection(value: unknown): value is GeoJSONFeatureCollection {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { type?: unknown }).type === 'FeatureCollection' &&
      Array.isArray((value as { features?: unknown }).features),
  );
}

function isLegacyMapResponse(value: unknown): value is { results: unknown[] } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Array.isArray((value as { results?: unknown }).results),
  );
}

function featureCollectionHasPreviewText(featureCollection: GeoJSONFeatureCollection) {
  return featureCollection.features.every((value) => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const feature = value as StoryMapFeatureRecord;
    const properties =
      feature.properties && typeof feature.properties === 'object'
        ? (feature.properties as Record<string, unknown>)
        : undefined;

    return Boolean(properties && asString(properties.preview_text));
  });
}

function getProximityFilter(filters: StoryFilters) {
  if (
    filters.latitude === undefined ||
    filters.longitude === undefined ||
    filters.radiusKm === undefined
  ) {
    return undefined;
  }

  return {
    latitude: filters.latitude,
    longitude: filters.longitude,
    radiusKm: filters.radiusKm,
  };
}

function isRecordWithinRadius(
  story: StoryRecord,
  proximity: { latitude: number; longitude: number; radiusKm: number },
) {
  const latitude = asNumber(story.location_lat);
  const longitude = asNumber(story.location_lng);

  if (latitude === undefined || longitude === undefined) {
    return false;
  }

  return haversineKm(proximity.latitude, proximity.longitude, latitude, longitude) <= proximity.radiusKm;
}

function haversineKm(startLat: number, startLng: number, endLat: number, endLng: number) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(endLat - startLat);
  const deltaLng = toRadians(endLng - startLng);
  const startLatRad = toRadians(startLat);
  const endLatRad = toRadians(endLat);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLatRad) * Math.cos(endLatRad) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
