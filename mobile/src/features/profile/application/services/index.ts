import { ProfileRepositoryImpl } from '../../data/repositories';
import { FollowListResult, ProfileEntity, ProfilePhotoUploadInput, UpdateProfileInput } from '../../domain/entities';
import { FeedPageEntity } from '../../../feed/domain/entities';

const repository = new ProfileRepositoryImpl();

export const userService = {
  async getCurrentProfile(): Promise<ProfileEntity> {
    return repository.getCurrentProfile();
  },
  async getPublicProfile(userId: string): Promise<ProfileEntity> {
    return repository.getPublicProfile(userId);
  },
  async updateCurrentProfile(input: UpdateProfileInput): Promise<ProfileEntity> {
    return repository.updateCurrentProfile(input);
  },
  async updateProfile(input: UpdateProfileInput): Promise<ProfileEntity> {
    return repository.updateCurrentProfile(input);
  },
  async uploadProfilePhoto(input: ProfilePhotoUploadInput): Promise<ProfileEntity> {
    return repository.uploadProfilePhoto(input);
  },
  async removeProfilePhoto(): Promise<ProfileEntity> {
    return repository.removeProfilePhoto();
  },
  async deleteAccount(password: string, deleteStories = true): Promise<void> {
    return repository.deleteAccount(password, deleteStories);
  },
  async followUser(userId: string): Promise<void> {
    return repository.followUser(userId);
  },
  async unfollowUser(userId: string): Promise<void> {
    return repository.unfollowUser(userId);
  },
  async getFollowers(userId: string, page = 1): Promise<FollowListResult> {
    return repository.getFollowers(userId, page);
  },
  async getFollowing(userId: string, page = 1): Promise<FollowListResult> {
    return repository.getFollowing(userId, page);
  },
  async getSavedStories(userId: string, page = 1): Promise<FeedPageEntity> {
    return repository.getSavedStories(userId, page);
  },
};
