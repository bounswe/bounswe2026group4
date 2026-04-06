import { ProfileRepositoryImpl } from '../../data/repositories';
import { ProfileEntity, UpdateProfileInput } from '../../domain/entities';

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
};
