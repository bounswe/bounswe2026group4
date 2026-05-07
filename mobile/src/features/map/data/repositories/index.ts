import { storyService } from '../../../stories/application/services';
import { StoryFilters } from '../../../stories/domain/repositories';
import { MapMarkerGroup } from '../../domain/entities';

export class MapRepositoryImpl {
  async getMarkerGroups(filters: StoryFilters = {}): Promise<MapMarkerGroup[]> {
    const pins = await storyService.getMapPins(filters);
    const groupsByCoordinate = new Map<string, typeof pins>();

    pins.forEach((pin) => {
      const key = `${pin.latitude}:${pin.longitude}`;
      const group = groupsByCoordinate.get(key);

      if (group) {
        group.push(pin);
        return;
      }

      groupsByCoordinate.set(key, [pin]);
    });

    return Array.from(groupsByCoordinate.entries()).map(([coordinateKey, group]) => {
      const firstPin = group[0];

      return {
        id: group.length === 1 ? firstPin.id : `coordinate:${coordinateKey}`,
        latitude: firstPin.latitude,
        longitude: firstPin.longitude,
        stories: group,
        count: group.length,
        isCluster: group.length > 1,
      };
    });
  }
}
