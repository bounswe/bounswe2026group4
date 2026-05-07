export type FeedSortOption = 'recent' | 'popular';

export interface FeedEntity {
  id: string;
  title: string;
  locationName: string;
  timePeriod: string;
  previewText: string;
  submittedAt: string;
  hasMedia: boolean;
  likeCount: number;
  likedByViewer: boolean;
  savedByViewer: boolean;
  tags?: string[];
}

export interface FeedPageEntity {
  items: FeedEntity[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasNextPage: boolean;
}
