import { storyService } from '..';
import { StoryRepositoryImpl } from '../../../data/repositories';
import { feedService } from '../../../../feed/application/services';
import { timelineService } from '../../../../timeline/application/services';

describe('storyService', () => {
  it('delegates getStories to the repository with filters', async () => {
    const getStoriesSpy = jest.spyOn(StoryRepositoryImpl.prototype, 'getStories').mockResolvedValue([]);

    await storyService.getStories({ q: 'galata', location: 'Beyoglu' });

    expect(getStoriesSpy).toHaveBeenCalledWith({ q: 'galata', location: 'Beyoglu' });

    getStoriesSpy.mockRestore();
  });

  it('delegates getMapPins to the repository with filters', async () => {
    const getMapPinsSpy = jest.spyOn(StoryRepositoryImpl.prototype, 'getMapPins').mockResolvedValue([]);

    await storyService.getMapPins({ yearFrom: 1900, yearTo: 1950 });

    expect(getMapPinsSpy).toHaveBeenCalledWith({ yearFrom: 1900, yearTo: 1950 });

    getMapPinsSpy.mockRestore();
  });

  it('delegates deleteStory to the repository', async () => {
    const deleteStorySpy = jest.spyOn(StoryRepositoryImpl.prototype, 'deleteStory').mockResolvedValue(undefined);

    await storyService.deleteStory('42');

    expect(deleteStorySpy).toHaveBeenCalledWith('42');

    deleteStorySpy.mockRestore();
  });

  it('delegates getFeed to the feed service', async () => {
    const getFeedSpy = jest.spyOn(feedService, 'getFeed').mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      totalCount: 0,
      hasNextPage: false,
    });

    await storyService.getFeed({ page: 3, sort: 'recent', filters: { q: 'bridge' } });

    expect(getFeedSpy).toHaveBeenCalledWith({
      page: 3,
      sort: 'recent',
      filters: { q: 'bridge' },
    });

    getFeedSpy.mockRestore();
  });

  it('delegates getTimeline to the timeline service', async () => {
    const getTimelineSpy = jest.spyOn(timelineService, 'getTimeline').mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      totalCount: 0,
      hasNextPage: false,
    });

    await storyService.getTimeline({ page: 2, decade: 1920, filters: { location: 'Istanbul' } });

    expect(getTimelineSpy).toHaveBeenCalledWith({
      page: 2,
      decade: 1920,
      filters: { location: 'Istanbul' },
    });

    getTimelineSpy.mockRestore();
  });
});
