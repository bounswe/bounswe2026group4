import { storageKeys } from '../../../../core/storage/keys';
import { storage } from '../../../../core/storage/storage';
import { AuthSessionEntity } from '../../domain/entities';

function createUserName(email: string) {
  return email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function createToken(email: string) {
  return `mock-jwt-${email.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export const authRemoteSource = {
  async login(email: string, password: string): Promise<AuthSessionEntity> {
    if (!email.includes('@') || password.trim().length < 8) {
      throw new Error('Invalid credentials. Use a valid email and at least 8 characters.');
    }

    const role = email.includes('admin') ? 'admin' : 'user';

    return {
      token: createToken(email),
      user: {
        id: `user-${email.toLowerCase()}`,
        name: createUserName(email),
        email: email.toLowerCase(),
        role,
      },
    };
  },
};

export const authLocalSource = {
  async getSession() {
    return storage.get<AuthSessionEntity>(storageKeys.authSession);
  },
  async setSession(session: AuthSessionEntity) {
    await storage.set(storageKeys.authSession, session);
  },
  async clearSession() {
    await storage.remove(storageKeys.authSession);
  },
};
