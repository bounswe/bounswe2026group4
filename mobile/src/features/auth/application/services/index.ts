import { Session } from '../../../../core/auth/session';
import { authLocalSource, authRemoteSource, LoginPayload } from '../../data/sources';

export const authService = {
  async login(credentials: LoginPayload): Promise<Session> {
    const session = await authRemoteSource.login(credentials);
    await authLocalSource.saveSession(session);
    return session;
  },
  async restoreSession() {
    return authLocalSource.getSession();
  },
  async logout(session: Session) {
    try {
      await authRemoteSource.logout(session);
    } finally {
      await authLocalSource.clearSession();
    }
  },
};
