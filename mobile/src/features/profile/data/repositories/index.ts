import {
  FollowListResult,
  ProfileEntity,
  ProfilePhotoUploadInput,
  UpdateProfileInput,
} from '../../domain/entities';
import { ProfileRepository } from '../../domain/repositories';
import { mapCurrentProfile, mapFollowList, mapPublicProfile, mergePublicProfileSummary } from '../mappers';
import { profileRemoteSource } from '../sources';

export class ProfileRepositoryImpl implements ProfileRepository {
  async getCurrentProfile(): Promise<ProfileEntity> {
    const profile = await profileRemoteSource.getCurrentProfile();
    const mappedProfile = mapCurrentProfile(profile);

    try {
      const publicProfile = await profileRemoteSource.getPublicProfile(mappedProfile.id);
      return mergePublicProfileSummary(mappedProfile, publicProfile);
    } catch {
      return mappedProfile;
    }
  }

  async getPublicProfile(userId: string): Promise<ProfileEntity> {
    const profile = await profileRemoteSource.getPublicProfile(userId);
    return mapPublicProfile(profile);
  }

  async updateCurrentProfile(input: UpdateProfileInput): Promise<ProfileEntity> {
    const profile = await profileRemoteSource.updateCurrentProfile(input);
    const mappedProfile = mapCurrentProfile(profile);

    try {
      const publicProfile = await profileRemoteSource.getPublicProfile(mappedProfile.id);
      return mergePublicProfileSummary(mappedProfile, publicProfile);
    } catch {
      return mappedProfile;
    }
  }

  async uploadProfilePhoto(input: ProfilePhotoUploadInput): Promise<ProfileEntity> {
    await profileRemoteSource.uploadProfilePhoto(input);
    return this.getCurrentProfile();
  }

  async removeProfilePhoto(): Promise<ProfileEntity> {
    await profileRemoteSource.removeProfilePhoto();
    return this.getCurrentProfile();
  }

  async deleteAccount(password: string, deleteStories = true): Promise<void> {
    await profileRemoteSource.deleteAccount(password, deleteStories);
  }

  async followUser(userId: string): Promise<void> {
    await profileRemoteSource.followUser(userId);
  }

  async unfollowUser(userId: string): Promise<void> {
    await profileRemoteSource.unfollowUser(userId);
  }

  async getFollowers(userId: string, page = 1): Promise<FollowListResult> {
    const payload = await profileRemoteSource.getFollowers(userId, page);
    return mapFollowList(payload);
  }

  async getFollowing(userId: string, page = 1): Promise<FollowListResult> {
    const payload = await profileRemoteSource.getFollowing(userId, page);
    return mapFollowList(payload);
  }
}
