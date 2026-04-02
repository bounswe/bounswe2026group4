export type FeedSortOption = 'recent';

export interface FeedEntity {
  id: string;
  title: string;
  locationName: string;
  timePeriod: string;
  previewText: string;
  submittedAt: string;
  hasMedia: boolean;
}

export interface FeedPageEntity {
  items: FeedEntity[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasNextPage: boolean;
}
