import { ProfileEntity, ProfilePhotoUploadInput, UpdateProfileInput } from '../entities';

export interface ProfileRepository {
  getCurrentProfile(): Promise<ProfileEntity>;
  getPublicProfile(userId: string): Promise<ProfileEntity>;
  updateCurrentProfile(input: UpdateProfileInput): Promise<ProfileEntity>;
  uploadProfilePhoto(input: ProfilePhotoUploadInput): Promise<ProfileEntity>;
  removeProfilePhoto(): Promise<ProfileEntity>;
  deleteAccount(password: string, deleteStories?: boolean): Promise<void>;
}
