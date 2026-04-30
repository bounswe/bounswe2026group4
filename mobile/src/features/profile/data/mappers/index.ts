import { FollowListResult, FollowUserEntity, ProfileEntity } from '../../domain/entities';

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

function getNestedProfile(profile: Record<string, unknown>) {
  return profile.profile && typeof profile.profile === 'object'
    ? (profile.profile as Record<string, unknown>)
    : {};
}

function hasPublishedStoryCount(profile: Record<string, unknown>) {
  const stats =
    profile.stats && typeof profile.stats === 'object'
      ? (profile.stats as Record<string, unknown>)
      : {};

  return (
    profile.published_story_count !== undefined ||
    profile.publishedStoryCount !== undefined ||
    stats.published_story_count !== undefined ||
    stats.publishedStoryCount !== undefined
  );
}

export function mapCurrentProfile(profile: Record<string, unknown>): ProfileEntity {
  const nestedProfile = getNestedProfile(profile);

  return {
    id: asString(profile.id),
    username: asNullableString(profile.username),
    email: asNullableString(profile.email),
    totalPoints: asNumber(profile.total_points ?? profile.totalPoints),
    dateJoined: asString(profile.date_joined ?? profile.dateJoined) || undefined,
    firstName: asNullableString(nestedProfile.first_name ?? nestedProfile.firstName),
    lastName: asNullableString(nestedProfile.last_name ?? nestedProfile.lastName),
    bio: asNullableString(nestedProfile.bio),
    location: asNullableString(nestedProfile.location),
    birthDate: asNullableString(nestedProfile.birth_date ?? nestedProfile.birthDate),
    profilePhoto: asNullableString(
      nestedProfile.profile_photo ??
        nestedProfile.profilePhoto ??
        nestedProfile.profile_photo_url ??
        nestedProfile.profilePhotoUrl,
    ),
    isUsernamePublic:
      profile.is_username_public === undefined && profile.isUsernamePublic === undefined
        ? undefined
        : Boolean(profile.is_username_public ?? profile.isUsernamePublic),
    isEmailVerified:
      profile.is_email_verified === undefined && profile.isEmailVerified === undefined
        ? undefined
        : Boolean(profile.is_email_verified ?? profile.isEmailVerified),
    isNamePublic:
      nestedProfile.is_name_public === undefined && nestedProfile.isNamePublic === undefined
        ? undefined
        : Boolean(nestedProfile.is_name_public ?? nestedProfile.isNamePublic),
    isLocationPublic:
      nestedProfile.is_location_public === undefined && nestedProfile.isLocationPublic === undefined
        ? undefined
        : Boolean(nestedProfile.is_location_public ?? nestedProfile.isLocationPublic),
    isBirthDatePublic:
      nestedProfile.is_birth_date_public === undefined && nestedProfile.isBirthDatePublic === undefined
        ? undefined
        : Boolean(nestedProfile.is_birth_date_public ?? nestedProfile.isBirthDatePublic),
    isPhotoPublic:
      nestedProfile.is_photo_public === undefined && nestedProfile.isPhotoPublic === undefined
        ? undefined
        : Boolean(nestedProfile.is_photo_public ?? nestedProfile.isPhotoPublic),
  };
}

export function mapPublicProfile(profile: Record<string, unknown>): ProfileEntity {
  const nestedProfile = getNestedProfile(profile);
  const stats =
    profile.stats && typeof profile.stats === 'object'
      ? (profile.stats as Record<string, unknown>)
      : {};

  return {
    id: asString(profile.id),
    username: asNullableString(profile.username),
    totalPoints: asNumber(profile.total_points ?? profile.totalPoints),
    dateJoined: asString(profile.date_joined ?? profile.dateJoined) || undefined,
    publishedStoryCount: asNumber(
      profile.published_story_count ??
        profile.publishedStoryCount ??
        stats.published_story_count ??
        stats.publishedStoryCount,
    ),
    followersCount: asNumber(profile.followers_count ?? profile.followersCount),
    followingCount: asNumber(profile.following_count ?? profile.followingCount),
    isFollowedByMe:
      profile.is_followed_by_me === undefined && profile.isFollowedByMe === undefined
        ? undefined
        : Boolean(profile.is_followed_by_me ?? profile.isFollowedByMe),
    firstName: asNullableString(profile.first_name ?? profile.firstName ?? nestedProfile.first_name ?? nestedProfile.firstName),
    lastName: asNullableString(profile.last_name ?? profile.lastName ?? nestedProfile.last_name ?? nestedProfile.lastName),
    bio: asNullableString(profile.bio ?? nestedProfile.bio),
    location: asNullableString(profile.location ?? nestedProfile.location),
    birthYear: asNullableNumber(profile.birth_year ?? profile.birthYear ?? nestedProfile.birth_year ?? nestedProfile.birthYear),
    profilePhoto: asNullableString(
      profile.profile_photo ??
        profile.profilePhoto ??
        profile.profile_photo_url ??
        profile.profilePhotoUrl ??
        nestedProfile.profile_photo ??
        nestedProfile.profilePhoto ??
        nestedProfile.profile_photo_url ??
        nestedProfile.profilePhotoUrl,
    ),
    isUsernamePublic:
      profile.is_username_public === undefined && profile.isUsernamePublic === undefined
        ? undefined
        : Boolean(profile.is_username_public ?? profile.isUsernamePublic),
  };
}

export function mergePublicProfileSummary(
  profile: ProfileEntity,
  publicProfile: Record<string, unknown>,
) {
  const mappedPublicProfile = mapPublicProfile(publicProfile);

  return {
    ...profile,
    publishedStoryCount: hasPublishedStoryCount(publicProfile)
      ? mappedPublicProfile.publishedStoryCount
      : profile.publishedStoryCount,
    birthYear: profile.birthDate ? profile.birthYear : mappedPublicProfile.birthYear ?? profile.birthYear,
  };
}

export function mapProfile(value: unknown) {
  return value && typeof value === 'object' ? mapPublicProfile(value as Record<string, unknown>) : value;
}

export function mapFollowUser(user: Record<string, unknown>): FollowUserEntity {
  return {
    id: asString(user.id),
    username: asNullableString(user.username),
    profilePhoto: asNullableString(user.profile_photo),
  };
}

export function mapFollowList(payload: Record<string, unknown>): FollowListResult {
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
