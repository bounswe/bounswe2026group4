import {
  getProfilePath,
  getForgotPasswordPath,
  getResetPasswordPath,
  getResetPasswordTokenFromPath,
  getStoryIdFromPath,
  getStoryPath,
  getUserIdFromProfilePath,
  getUserProfilePath,
  isForgotPasswordPath,
  linking,
} from '../linking';

describe('linking', () => {
  it('defines the profile and story route patterns', () => {
    expect(linking.config.screens.Profile).toBe('profile');
    expect(linking.config.screens.ForgotPassword).toBe('forgot-password');
    expect(linking.config.screens.ResetPassword).toBe('reset-password');
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

  it('builds and parses password reset paths', () => {
    expect(getForgotPasswordPath()).toBe('/forgot-password');
    expect(isForgotPasswordPath('/forgot-password')).toBe(true);
    expect(isForgotPasswordPath('https://app.example.com/forgot-password')).toBe(true);
    expect(getResetPasswordPath('token 123')).toBe('/reset-password?token=token%20123');
    expect(getResetPasswordTokenFromPath('/reset-password?token=abc-123')).toBe('abc-123');
    expect(getResetPasswordTokenFromPath('/reset-password/abc-123')).toBe('abc-123');
    expect(getResetPasswordTokenFromPath('https://app.example.com/reset-password?token=abc-123')).toBe('abc-123');
    expect(getResetPasswordTokenFromPath('storymap://reset-password?token=abc-123')).toBe('abc-123');
    expect(getResetPasswordTokenFromPath('/profile')).toBeNull();
  });
});
