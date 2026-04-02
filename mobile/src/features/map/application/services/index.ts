import { StoryFilters } from '../../../stories/domain/repositories';
import { MapMarkerGroup } from '../../domain/entities';
import { MapRepositoryImpl } from '../../data/repositories';

const repository = new MapRepositoryImpl();

export const mapService = {
  async getMarkerGroups(filters?: StoryFilters): Promise<MapMarkerGroup[]> {
    return repository.getMarkerGroups(filters);
  },
};
