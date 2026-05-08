export interface ProfileEntity {
  id: string;
  username: string | null;
  email?: string | null;
  totalPoints: number;
  dateJoined?: string;
  publishedStoryCount?: number;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  location?: string | null;
  birthDate?: string | null;
  birthYear?: number | null;
  profilePhoto?: string | null;
  followersCount?: number;
  followingCount?: number;
  isFollowedByMe?: boolean;
  isUsernamePublic?: boolean;
  isEmailVerified?: boolean;
  isNamePublic?: boolean;
  isLocationPublic?: boolean;
  isBirthDatePublic?: boolean;
  isPhotoPublic?: boolean;
}

export interface ProfilePhotoUploadInput {
  uri: string;
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png';
}

export interface UpdateProfileInput {
  username?: string;
  isUsernamePublic?: boolean;
  firstName?: string;
  lastName?: string;
  bio?: string;
  location?: string;
  birthDate?: string | null;
  isNamePublic?: boolean;
  isLocationPublic?: boolean;
  isBirthDatePublic?: boolean;
  isPhotoPublic?: boolean;
}

export interface FollowUserEntity {
  id: string;
  username: string | null;
  profilePhoto?: string | null;
}

export interface FollowListResult {
  users: FollowUserEntity[];
  next: string | null;
  previous: string | null;
  count: number;
}

export interface PointsSummaryEntity {
  userId: string;
  totalPoints: number;
}

export interface BadgeEntity {
  id: string;
  name: string;
  description: string | null;
  criteriaType: string | null;
  criteriaThreshold: number | null;
  awardedAt: string | null;
}
