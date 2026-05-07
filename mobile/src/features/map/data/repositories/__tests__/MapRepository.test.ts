import { MapRepositoryImpl } from '..';
import { storyService } from '../../../../stories/application/services';

jest.mock('../../../../stories/application/services', () => ({
  storyService: {
    getMapPins: jest.fn(),
  },
}));

describe('MapRepositoryImpl', () => {
  beforeEach(() => {
    jest.mocked(storyService.getMapPins).mockReset();
  });

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

  it('groups pins with duplicate coordinates into a tappable cluster marker', async () => {
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
        latitude: 41.02,
        longitude: 28.96,
      },
      {
        id: 'story-3',
        title: 'Story 3',
        placeName: 'Balat',
        timePeriod: '2023',
        previewText: 'Preview 3',
        latitude: 41.031,
        longitude: 28.949,
      },
    ]);

    const repository = new MapRepositoryImpl();
    const markers = await repository.getMarkerGroups();

    expect(markers).toEqual([
      {
        id: 'coordinate:41.02:28.96',
        latitude: 41.02,
        longitude: 28.96,
        stories: [
          expect.objectContaining({ id: 'story-1' }),
          expect.objectContaining({ id: 'story-2' }),
        ],
        count: 2,
        isCluster: true,
      },
      {
        id: 'story-3',
        latitude: 41.031,
        longitude: 28.949,
        stories: [expect.objectContaining({ id: 'story-3' })],
        count: 1,
        isCluster: false,
      },
    ]);
  });
});
