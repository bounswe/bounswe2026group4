export type TimelineTimeType =
  | 'exact_year'
  | 'approximate_year'
  | 'decade'
  | 'year_range'
  | 'exact_date';

export type TimelinePeriodPosition = 'early' | 'mid' | 'late';

export interface TimelineApproximatePeriod {
  century: number;
  position: TimelinePeriodPosition;
}

export interface TimelineEntity {
  id: string;
  title: string;
  timeType: TimelineTimeType | string;
  timePeriod: string;
  temporalCoverage?: string;
  historicalYear?: number;
  year?: number;
  yearStart?: number;
  yearEnd?: number;
  dateValue?: string;
  timeValue?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
}

export interface TimelinePageEntity {
  items: TimelineEntity[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasNextPage: boolean;
}
