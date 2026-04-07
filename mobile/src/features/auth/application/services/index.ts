import { AuthRepositoryImpl } from '../../data/repositories';
import { AuthSessionEntity } from '../../domain/entities';
import { RegisterUserInput, RegisterUserResult } from '../../domain/repositories';

const repository = new AuthRepositoryImpl();

export const authService = {
  async login(email: string, password: string): Promise<AuthSessionEntity> {
    return repository.login(email, password);
  },
  async register(input: RegisterUserInput): Promise<RegisterUserResult> {
    return repository.register(input);
  },
  async restore(): Promise<AuthSessionEntity | null> {
    return repository.restore();
  },
  async refresh(session: AuthSessionEntity): Promise<AuthSessionEntity> {
    return repository.refresh(session);
  },
  async logout(session?: AuthSessionEntity | null): Promise<void> {
    return repository.logout(session);
  },
  async updateUser(user: AuthSessionEntity['user']): Promise<AuthSessionEntity | null> {
    return repository.updateUser(user);
  },
  async clear(): Promise<void> {
    return repository.clear();
  },
};
