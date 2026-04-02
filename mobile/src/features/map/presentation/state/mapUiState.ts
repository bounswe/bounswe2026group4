import { StoryFilters } from '../../../stories/domain/repositories';
import { MapMarkerGroup } from '../../domain/entities';

export interface MapUiState {
  isLoading: boolean;
  error?: string;
  filters: StoryFilters;
  markers: MapMarkerGroup[];
  selectedMarkerId?: string;
}

export function createInitialMapUiState(filters: StoryFilters = {}): MapUiState {
  return {
    isLoading: true,
    filters,
    markers: [],
  };
}
