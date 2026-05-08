import { TimelinePageEntity } from '../../domain/entities';
import { TimelineRepository, TimelineRequest } from '../../domain/repositories';
import { mapTimelinePage } from '../mappers';
import { resolveTimelinePeriodYears, timelineLocalSource, timelineRemoteSource } from '../sources';

export class TimelineRepositoryImpl implements TimelineRepository {
  async getTimeline(request: TimelineRequest = {}): Promise<TimelinePageEntity> {
    const page = request.page ?? 1;
    const pageSize = request.pageSize ?? timelineLocalSource.pageSize;
    const response = await timelineRemoteSource.getTimeline({
      ...request,
      page,
      pageSize,
    });

    return filterTimelinePageByRequestedPeriod(mapTimelinePage(response, page, pageSize), request);
  }
}

function filterTimelinePageByRequestedPeriod(page: TimelinePageEntity, request: TimelineRequest): TimelinePageEntity {
  const periodYears = resolveTimelinePeriodYears(request);

  if (!periodYears) {
    return page;
  }

  const items = page.items.filter((item) => {
    if (item.historicalYear === undefined) {
      return true;
    }

    return item.historicalYear >= periodYears.yearFrom && item.historicalYear <= periodYears.yearTo;
  });

  return {
    ...page,
    items,
    totalCount: items.length,
    hasNextPage: page.hasNextPage && items.length === page.items.length,
  };
}
