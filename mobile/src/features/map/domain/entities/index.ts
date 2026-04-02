import { StoryMapPin } from '../../../stories/domain/entities';
import { StoryFilters } from '../../../stories/domain/repositories';

export interface MapMarkerGroup {
  id: string;
  latitude: number;
  longitude: number;
  stories: StoryMapPin[];
  count: number;
  isCluster: boolean;
}

export interface MapEntity {
  filters: StoryFilters;
  markers: MapMarkerGroup[];
}
