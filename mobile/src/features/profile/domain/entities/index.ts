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
