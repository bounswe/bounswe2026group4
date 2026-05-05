import { TimelineRequest } from '../../domain/repositories';
import { timelineService } from '../services';

export async function getTimeline(request: TimelineRequest = {}) {
  return timelineService.getTimeline(request);
}
