import {
  FollowListResult,
  FollowUserEntity,
  ProfileEntity,
  ProfilePhotoUploadInput,
  UpdateProfileInput,
} from '../../domain/entities';
import { ProfileRepository } from '../../domain/repositories';
import { profileRemoteSource } from '../sources';

function asString(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '';
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function asNullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNullableNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asOptionalBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }

    if (value.toLowerCase() === 'false') {
      return false;
    }
  }

  return undefined;
}

function mapCurrentProfile(profile: Record<string, unknown>): ProfileEntity {
  const nestedProfile =
    profile.profile && typeof profile.profile === 'object'
      ? (profile.profile as Record<string, unknown>)
      : {};

  return {
    id: asString(profile.id),
    username: asNullableString(profile.username),
    email: asNullableString(profile.email),
    totalPoints: asNumber(profile.total_points),
    dateJoined: asString(profile.date_joined) || undefined,
    firstName: asNullableString(nestedProfile.first_name),
    lastName: asNullableString(nestedProfile.last_name),
    bio: asNullableString(nestedProfile.bio),
    location: asNullableString(nestedProfile.location),
    birthDate: asNullableString(nestedProfile.birth_date),
    profilePhoto: asNullableString(nestedProfile.profile_photo),
    followersCount: asNumber(profile.followers_count),
    followingCount: asNumber(profile.following_count),
    isFollowedByMe: asOptionalBoolean(profile.is_followed_by_me),
    isUsernamePublic: Boolean(profile.is_username_public),
    isEmailVerified: Boolean(profile.is_email_verified),
    isNamePublic: nestedProfile.is_name_public === undefined ? undefined : Boolean(nestedProfile.is_name_public),
    isLocationPublic: nestedProfile.is_location_public === undefined ? undefined : Boolean(nestedProfile.is_location_public),
    isBirthDatePublic:
      nestedProfile.is_birth_date_public === undefined ? undefined : Boolean(nestedProfile.is_birth_date_public),
    isPhotoPublic: nestedProfile.is_photo_public === undefined ? undefined : Boolean(nestedProfile.is_photo_public),
  };
}

function mergePublicProfileSummary(
  profile: ProfileEntity,
  publicProfile: Record<string, unknown>,
) {
  const birthYear = asNullableNumber(publicProfile.birth_year);
  const publishedStoryCount = asNumber(publicProfile.published_story_count);

  return {
    ...profile,
    publishedStoryCount:
      publicProfile.published_story_count === undefined
        ? profile.publishedStoryCount
        : publishedStoryCount,
    birthYear: profile.birthDate ? profile.birthYear : birthYear ?? profile.birthYear,
    followersCount: asNumber(publicProfile.followers_count),
    followingCount: asNumber(publicProfile.following_count),
    isFollowedByMe: asOptionalBoolean(publicProfile.is_followed_by_me) ?? profile.isFollowedByMe,
  };
}

function mapPublicProfile(profile: Record<string, unknown>): ProfileEntity {
  return {
    id: asString(profile.id),
    username: asNullableString(profile.username),
    totalPoints: asNumber(profile.total_points),
    dateJoined: asString(profile.date_joined) || undefined,
    publishedStoryCount: asNumber(profile.published_story_count),
    firstName: asNullableString(profile.first_name),
    lastName: asNullableString(profile.last_name),
    bio: asNullableString(profile.bio),
    location: asNullableString(profile.location),
    birthYear: asNullableNumber(profile.birth_year),
    profilePhoto: asNullableString(profile.profile_photo),
    followersCount: asNumber(profile.followers_count),
    followingCount: asNumber(profile.following_count),
    isFollowedByMe: asOptionalBoolean(profile.is_followed_by_me),
  };
}

function mapFollowUser(user: Record<string, unknown>): FollowUserEntity {
  return {
    id: asString(user.id),
    username: asNullableString(user.username),
    profilePhoto: asNullableString(user.profile_photo),
  };
}

function mapFollowList(payload: Record<string, unknown>): FollowListResult {
  const results = Array.isArray(payload.results) ? payload.results : [];

  return {
    users: results
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map(mapFollowUser),
    next: asNullableString(payload.next),
    previous: asNullableString(payload.previous),
    count: asNumber(payload.count),
  };
}

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
