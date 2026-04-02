import { getStoryIdFromPath, getStoryPath, linking } from '../linking';

describe('linking', () => {
  it('defines the story detail route pattern', () => {
    expect(linking.config.screens.StoryDetail).toBe('stories/:id');
  });

  it('builds and parses story paths', () => {
    expect(getStoryPath('story-001')).toBe('/stories/story-001');
    expect(getStoryIdFromPath('/stories/story-001')).toBe('story-001');
    expect(getStoryIdFromPath('/feed/story-001')).toBeNull();
  });
});
