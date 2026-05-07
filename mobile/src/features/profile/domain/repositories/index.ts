import { FollowListResult, ProfileEntity, ProfilePhotoUploadInput, UpdateProfileInput } from '../entities';
import { FeedPageEntity } from '../../../feed/domain/entities';

export interface ProfileRepository {
  getCurrentProfile(): Promise<ProfileEntity>;
  getPublicProfile(userId: string): Promise<ProfileEntity>;
  updateCurrentProfile(input: UpdateProfileInput): Promise<ProfileEntity>;
  uploadProfilePhoto(input: ProfilePhotoUploadInput): Promise<ProfileEntity>;
  removeProfilePhoto(): Promise<ProfileEntity>;
  deleteAccount(password: string, deleteStories?: boolean): Promise<void>;
  followUser(userId: string): Promise<void>;
  unfollowUser(userId: string): Promise<void>;
  getFollowers(userId: string, page?: number): Promise<FollowListResult>;
  getFollowing(userId: string, page?: number): Promise<FollowListResult>;
  getSavedStories(userId: string, page?: number): Promise<FeedPageEntity>;
  getUserStories(userId: string, page?: number): Promise<FeedPageEntity>;
}
