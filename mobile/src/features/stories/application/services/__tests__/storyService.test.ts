import { storyService } from '..';
import { StoryRepositoryImpl } from '../../../data/repositories';

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
});
