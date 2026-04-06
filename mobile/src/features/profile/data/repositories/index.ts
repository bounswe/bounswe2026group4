import { ProfileEntity, UpdateProfileInput } from '../../domain/entities';
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
    bio: asNullableString(nestedProfile.bio),
    location: asNullableString(nestedProfile.location),
    birthDate: asNullableString(nestedProfile.birth_date),
    profilePhoto: asNullableString(nestedProfile.profile_photo),
    isUsernamePublic: Boolean(profile.is_username_public),
    isEmailVerified: Boolean(profile.is_email_verified),
    isLocationPublic: nestedProfile.is_location_public === undefined ? undefined : Boolean(nestedProfile.is_location_public),
    isBirthDatePublic:
      nestedProfile.is_birth_date_public === undefined ? undefined : Boolean(nestedProfile.is_birth_date_public),
    isPhotoPublic: nestedProfile.is_photo_public === undefined ? undefined : Boolean(nestedProfile.is_photo_public),
  };
}

function mergePublishedStoryCount(profile: ProfileEntity, publishedStoryCount?: number) {
  return {
    ...profile,
    publishedStoryCount:
      typeof publishedStoryCount === 'number' && Number.isFinite(publishedStoryCount)
        ? publishedStoryCount
        : profile.publishedStoryCount,
  };
}

function mapPublicProfile(profile: Record<string, unknown>): ProfileEntity {
  return {
    id: asString(profile.id),
    username: asNullableString(profile.username),
    totalPoints: asNumber(profile.total_points),
    dateJoined: asString(profile.date_joined) || undefined,
    publishedStoryCount: asNumber(profile.published_story_count),
    bio: asNullableString(profile.bio),
    location: asNullableString(profile.location),
    birthYear: asNullableNumber(profile.birth_year),
    profilePhoto: asNullableString(profile.profile_photo),
  };
}

export class ProfileRepositoryImpl implements ProfileRepository {
  async getCurrentProfile(): Promise<ProfileEntity> {
    const profile = await profileRemoteSource.getCurrentProfile();
    const mappedProfile = mapCurrentProfile(profile);

    try {
      const publicProfile = await profileRemoteSource.getPublicProfile(mappedProfile.id);
      return mergePublishedStoryCount(
        mappedProfile,
        asNumber(publicProfile.published_story_count),
      );
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
      return mergePublishedStoryCount(
        mappedProfile,
        asNumber(publicProfile.published_story_count),
      );
    } catch {
      return mappedProfile;
    }
  }
}
