import { TimelineRepositoryImpl } from '../../data/repositories';
import { TimelinePageEntity } from '../../domain/entities';
import { TimelineRequest } from '../../domain/repositories';

const repository = new TimelineRepositoryImpl();

export const timelineService = {
  async getTimeline(request: TimelineRequest = {}): Promise<TimelinePageEntity> {
    return repository.getTimeline(request);
  },
};
