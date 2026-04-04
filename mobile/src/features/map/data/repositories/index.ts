import { storyService } from '../../../stories/application/services';
import { StoryFilters } from '../../../stories/domain/repositories';
import { MapMarkerGroup } from '../../domain/entities';

export class MapRepositoryImpl {
  async getMarkerGroups(filters: StoryFilters = {}): Promise<MapMarkerGroup[]> {
    const pins = await storyService.getMapPins(filters);

    return pins.map((pin) => ({
      id: pin.id,
      latitude: pin.latitude,
      longitude: pin.longitude,
      stories: [pin],
      count: 1,
      isCluster: false,
    }));
  }
}
