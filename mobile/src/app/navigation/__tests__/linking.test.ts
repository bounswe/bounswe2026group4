import {
  getProfilePath,
  getStoryIdFromPath,
  getStoryPath,
  getUserIdFromProfilePath,
  getUserProfilePath,
  linking,
} from '../linking';

describe('linking', () => {
  it('defines the profile and story route patterns', () => {
    expect(linking.config.screens.Profile).toBe('profile');
    expect(linking.config.screens.UserProfile).toBe('users/:id');
    expect(linking.config.screens.StoryDetail).toBe('stories/:id');
  });

  it('builds and parses profile and story paths', () => {
    expect(getProfilePath()).toBe('/profile');
    expect(getUserProfilePath('42')).toBe('/users/42');
    expect(getUserIdFromProfilePath('/users/42')).toBe('42');
    expect(getUserIdFromProfilePath('/profile')).toBeNull();
    expect(getStoryPath('story-001')).toBe('/stories/story-001');
    expect(getStoryIdFromPath('/stories/story-001')).toBe('story-001');
    expect(getStoryIdFromPath('/feed/story-001')).toBeNull();
  });
});
