import { ProfileRepositoryImpl } from '../../data/repositories';
import { ProfileEntity, ProfilePhotoUploadInput, UpdateProfileInput } from '../../domain/entities';

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
};
