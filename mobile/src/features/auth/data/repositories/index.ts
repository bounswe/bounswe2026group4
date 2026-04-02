import { AuthRepository } from '../../domain/repositories';
import { AuthSessionEntity } from '../../domain/entities';
import { mapAuth } from '../mappers';
import { authLocalSource, authRemoteSource } from '../sources';

export class AuthRepositoryImpl implements AuthRepository {
  async login(email: string, password: string): Promise<AuthSessionEntity> {
    const response = await authRemoteSource.login({
      email: email.trim().toLowerCase(),
      password,
    });
    const session = mapAuth(response);

    await authLocalSource.setSession(session);

    return session;
  }

  async restore(): Promise<AuthSessionEntity | null> {
    const storedSession = await authLocalSource.getSession();

    if (!storedSession) {
      return null;
    }

    try {
      return mapAuth(storedSession);
    } catch {
      await authLocalSource.clearSession();
      return null;
    }
  }

  async logout(session?: AuthSessionEntity | null): Promise<void> {
    try {
      if (session) {
        await authRemoteSource.logout(session);
      }
    } finally {
      await authLocalSource.clearSession();
    }
  }

  async clear(): Promise<void> {
    await authLocalSource.clearSession();
  }
}
