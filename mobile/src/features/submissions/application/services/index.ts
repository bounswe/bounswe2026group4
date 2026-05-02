import { apiClient } from '../../../../core/api/client';
import { endpoints } from '../../../../core/api/endpoints';

export type StoryTimeType = 'exact_year' | 'approximate_year' | 'decade' | 'year_range';

export interface SubmissionLocationInput {
  latitude: number;
  longitude: number;
}

export interface SubmissionImageInput {
  uri: string;
  name: string;
  type: string;
}

export interface CreateStoryInput {
  title: string;
  narrative: string;
  location: SubmissionLocationInput;
  placeName: string;
  timeType: StoryTimeType;
  year?: number;
  yearStart?: number;
  yearEnd?: number;
  tags: string[];
  image?: SubmissionImageInput | null;
}

interface StoryCreateResponse {
  id: number;
}

interface TagCreateResponse {
  id?: string | number;
}

function buildStoryFormData(input: CreateStoryInput, tagIds: string[] = []) {
  const formData = new FormData();

  formData.append('title', input.title.trim());
  formData.append('narrative', input.narrative.trim());
  formData.append('location_lat', input.location.latitude.toFixed(6));
  formData.append('location_lng', input.location.longitude.toFixed(6));
  formData.append('location_name', input.placeName.trim());
  formData.append('time_type', input.timeType);
  formData.append('contributor_visible', 'true');

  if (input.timeType === 'year_range') {
    if (typeof input.yearStart === 'number') {
      formData.append('year_start', String(input.yearStart));
    }
    if (typeof input.yearEnd === 'number') {
      formData.append('year_end', String(input.yearEnd));
    }
  } else if (typeof input.year === 'number') {
    formData.append('year', String(input.year));
  }

  tagIds.forEach((tagId) => {
    formData.append('tag_ids', tagId);
  });

  return formData;
}

async function resolveTagIds(tags: string[]) {
  const uniqueTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));

  const createdTags = await Promise.all(
    uniqueTags.map((tag) => apiClient.post<TagCreateResponse>('/tags/', { name: tag })),
  );

  return createdTags.map((tag) => {
    const id = tag?.id;

    if (typeof id === 'string' || typeof id === 'number') {
      return String(id);
    }

    throw new Error('Tag creation returned an invalid response.');
  });
}

function buildImageFormData(image: SubmissionImageInput) {
  const formData = new FormData();
  formData.append('file', {
    uri: image.uri,
    name: image.name,
    type: image.type,
  } as unknown as Blob);
  return formData;
}

export const submissionsService = {
  async createStory(input: CreateStoryInput): Promise<StoryCreateResponse> {
    const tagIds = await resolveTagIds(input.tags);
    const story = await apiClient.post<StoryCreateResponse>(
      `${endpoints.stories}/`,
      buildStoryFormData(input, tagIds),
    );

    if (!story) {
      throw new Error('Story creation returned an empty response.');
    }

    if (input.image) {
      await apiClient.post(
        `${endpoints.stories}/${story.id}/images/`,
        buildImageFormData(input.image),
      );
    }

    return story;
  },
};
