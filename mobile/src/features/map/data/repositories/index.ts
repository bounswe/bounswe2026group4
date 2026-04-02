import { storyService } from '../../../stories/application/services';
import { StoryFilters } from '../../../stories/domain/repositories';
import { MapMarkerGroup } from '../../domain/entities';

const CLUSTER_PRECISION = 350;

export class MapRepositoryImpl {
  async getMarkerGroups(filters: StoryFilters = {}): Promise<MapMarkerGroup[]> {
    const pins = await storyService.getMapPins(filters);
    const groups = new Map<string, MapMarkerGroup>();

    pins.forEach((pin) => {
      const latBucket = Math.round(pin.latitude * CLUSTER_PRECISION);
      const lngBucket = Math.round(pin.longitude * CLUSTER_PRECISION);
      const key = `${latBucket}:${lngBucket}`;
      const existing = groups.get(key);

      if (existing) {
        existing.stories.push(pin);
        existing.count = existing.stories.length;
        existing.isCluster = existing.count > 1;
        existing.latitude = average(existing.stories.map((story) => story.latitude));
        existing.longitude = average(existing.stories.map((story) => story.longitude));
        return;
      }

      groups.set(key, {
        id: key,
        latitude: pin.latitude,
        longitude: pin.longitude,
        stories: [pin],
        count: 1,
        isCluster: false,
      });
    });

    return Array.from(groups.values());
  }
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
