import { StoryStatus } from './StoryStatus';

export interface StoryCommentPreview {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface StoryLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface StoryEntity {
  id: string;
  contributorUserId?: string;
  title: string;
  narrative: string[];
  status: StoryStatus;
  location: StoryLocation;
  timePeriod: string;
  contributorName: string;
  submittedAt: string;
  mediaUrl?: string;
  likeCount: number;
  likedByViewer: boolean;
  comments: StoryCommentPreview[];
}

export interface StorySummaryEntity {
  id: string;
  title: string;
  previewText: string;
  placeName: string;
  timePeriod: string;
  latitude?: number;
  longitude?: number;
}

export interface StoryMapPin {
  id: string;
  title: string;
  previewText: string;
  placeName: string;
  timePeriod: string;
  latitude: number;
  longitude: number;
}
