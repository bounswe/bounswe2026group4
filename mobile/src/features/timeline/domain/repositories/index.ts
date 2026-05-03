import { StoryFilters } from '../../../stories/domain/repositories';
import { TimelineApproximatePeriod, TimelinePageEntity } from '../entities';

export interface TimelineYearRange {
  from: number;
  to: number;
}

export interface TimelineRequest {
  page?: number;
  pageSize?: number;
  filters?: StoryFilters;
  year?: number;
  yearRange?: TimelineYearRange;
  decade?: number;
  approximatePeriod?: TimelineApproximatePeriod;
  location?: string;
}

export interface TimelineRepository {
  getTimeline(request?: TimelineRequest): Promise<TimelinePageEntity>;
}
