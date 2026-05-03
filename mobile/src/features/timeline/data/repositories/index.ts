import { TimelinePageEntity } from '../../domain/entities';
import { TimelineRepository, TimelineRequest } from '../../domain/repositories';
import { mapTimelinePage } from '../mappers';
import { timelineLocalSource, timelineRemoteSource } from '../sources';

export class TimelineRepositoryImpl implements TimelineRepository {
  async getTimeline(request: TimelineRequest = {}): Promise<TimelinePageEntity> {
    const page = request.page ?? 1;
    const pageSize = request.pageSize ?? timelineLocalSource.pageSize;
    const response = await timelineRemoteSource.getTimeline({
      ...request,
      page,
      pageSize,
    });

    return mapTimelinePage(response, page, pageSize);
  }
}
