import { MapRepositoryImpl } from '..';
import { storyService } from '../../../../stories/application/services';

jest.mock('../../../../stories/application/services', () => ({
  storyService: {
    getMapPins: jest.fn(),
  },
}));

describe('MapRepositoryImpl', () => {
  it('returns one marker per story pin without clustering', async () => {
    const getMapPins = jest.mocked(storyService.getMapPins);
    getMapPins.mockResolvedValue([
      {
        id: 'story-1',
        title: 'Story 1',
        placeName: 'Golden Horn',
        timePeriod: '2021',
        previewText: 'Preview 1',
        latitude: 41.02,
        longitude: 28.96,
      },
      {
        id: 'story-2',
        title: 'Story 2',
        placeName: 'Golden Horn',
        timePeriod: '2022',
        previewText: 'Preview 2',
        latitude: 41.0202,
        longitude: 28.9601,
      },
    ]);

    const repository = new MapRepositoryImpl();
    const markers = await repository.getMarkerGroups({ yearFrom: 2021 });

    expect(markers).toHaveLength(2);
    expect(markers).toEqual([
      {
        id: 'story-1',
        latitude: 41.02,
        longitude: 28.96,
        stories: [expect.objectContaining({ id: 'story-1' })],
        count: 1,
        isCluster: false,
      },
      {
        id: 'story-2',
        latitude: 41.0202,
        longitude: 28.9601,
        stories: [expect.objectContaining({ id: 'story-2' })],
        count: 1,
        isCluster: false,
      },
    ]);
  });
});
