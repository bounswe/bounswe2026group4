import { AuthRepository } from '../../domain/repositories';
import { AuthSessionEntity } from '../../domain/entities';
import { mapAuth } from '../mappers';
import { authLocalSource, authRemoteSource } from '../sources';

export class AuthRepositoryImpl implements AuthRepository {
  async login(email: string, password: string): Promise<AuthSessionEntity> {
    const response = await authRemoteSource.login(email, password);
    const session = mapAuth(response);

    await authLocalSource.setSession(session);

    return session;
  }

  async restore(): Promise<AuthSessionEntity | null> {
    const session = await authLocalSource.getSession();

    return session ? mapAuth(session) : null;
  }

  async logout(): Promise<void> {
    await authLocalSource.clearSession();
  }
}
