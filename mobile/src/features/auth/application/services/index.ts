import { AuthRepositoryImpl } from '../../data/repositories';
import { AuthSessionEntity } from '../../domain/entities';

const repository = new AuthRepositoryImpl();

export const authService = {
  async login(email: string, password: string): Promise<AuthSessionEntity> {
    return repository.login(email, password);
  },
  async restore(): Promise<AuthSessionEntity | null> {
    return repository.restore();
  },
  async logout(session?: AuthSessionEntity | null): Promise<void> {
    return repository.logout(session);
  },
  async clear(): Promise<void> {
    return repository.clear();
  },
};
