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
  temporalCoverageIso8601?: string;
  contributorName: string;
  isContributorAnonymous?: boolean;
  submittedAt: string;
  mediaUrl?: string;
  mediaAltText?: string;
  tags?: string[];
  likeCount: number;
  likedByViewer: boolean;
  savedByViewer: boolean;
  comments: StoryCommentPreview[];
}

export interface StorySummaryEntity {
  id: string;
  title: string;
  previewText: string;
  placeName: string;
  timePeriod: string;
  temporalCoverageIso8601?: string;
  tags?: string[];
  latitude?: number;
  longitude?: number;
}

export interface StoryMapPin {
  id: string;
  title: string;
  previewText: string;
  placeName: string;
  timePeriod: string;
  temporalCoverageIso8601?: string;
  tags?: string[];
  latitude: number;
  longitude: number;
}
