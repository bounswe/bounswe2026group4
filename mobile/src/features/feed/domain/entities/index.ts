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
  savedByViewer: boolean;
}

export interface FeedPageEntity {
  items: FeedEntity[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasNextPage: boolean;
}
