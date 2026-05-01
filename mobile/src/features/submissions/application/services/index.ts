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

export type SubmissionMediaType = 'audio' | 'video';

export interface SubmissionMediaInput {
  uri: string;
  name: string;
  type: string;
  mediaType: SubmissionMediaType;
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
  audio?: SubmissionMediaInput | null;
  video?: SubmissionMediaInput | null;
  contributorVisible: boolean;
}

interface StoryCreateResponse {
  id: number;
}

function buildStoryFormData(input: CreateStoryInput) {
  const formData = new FormData();

  formData.append('title', input.title.trim());
  formData.append('narrative', input.narrative.trim());
  formData.append('location_lat', input.location.latitude.toFixed(6));
  formData.append('location_lng', input.location.longitude.toFixed(6));
  formData.append('location_name', input.placeName.trim());
  formData.append('time_type', input.timeType);
  formData.append('contributor_visible', input.contributorVisible ? 'true' : 'false');

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

  return formData;
}

function buildUploadFormData(file: SubmissionImageInput | SubmissionMediaInput) {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);
  return formData;
}

export const submissionsService = {
  async createStory(input: CreateStoryInput): Promise<StoryCreateResponse> {
    const story = await apiClient.post<StoryCreateResponse>(
      `${endpoints.stories}/`,
      buildStoryFormData(input),
    );

    if (!story) {
      throw new Error('Story creation returned an empty response.');
    }

    if (input.image) {
      await apiClient.post(
        `${endpoints.stories}/${story.id}/images/`,
        buildUploadFormData(input.image),
      );
    }

    const mediaUploads = [input.audio, input.video].filter(
      (media): media is SubmissionMediaInput => Boolean(media),
    );

    for (const media of mediaUploads) {
      await apiClient.post(
        `${endpoints.stories}/${story.id}/media/`,
        buildUploadFormData(media),
      );
    }

    return story;
  },
};
