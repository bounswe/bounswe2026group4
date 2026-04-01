import { apiClient } from '../../../../core/api/client';
import { endpoints } from '../../../../core/api/endpoints';
import { AppRole, Session } from '../../../../core/auth/session';
import { storageKeys } from '../../../../core/storage/keys';
import { storage } from '../../../../core/storage/storage';

export interface LoginPayload {
  email: string;
  password: string;
}

interface BackendUser {
  id: number;
  email: string;
  username: string;
  role: 'registered_user' | 'admin';
}

interface LoginResponse {
  access: string;
  refresh: string;
  user: BackendUser;
}

function mapBackendRole(role: BackendUser['role']): AppRole {
  return role === 'admin' ? 'admin' : 'user';
}

function toSession(response: LoginResponse): Session {
  const role = mapBackendRole(response.user.role);

  return {
    accessToken: response.access,
    refreshToken: response.refresh,
    role,
    user: {
      ...response.user,
      role,
    },
  };
}

export const authRemoteSource = {
  async login(payload: LoginPayload): Promise<Session> {
    const response = await apiClient.post<LoginResponse>(`${endpoints.auth}/login/`, payload);

    if (!response) {
      throw new Error('Login did not return a session payload.');
    }

    return toSession(response);
  },
  async logout(session: Session): Promise<void> {
    await apiClient.post<void>(
      `${endpoints.auth}/logout/`,
      { refresh: session.refreshToken },
      { token: session.accessToken },
    );
  },
};

export const authLocalSource = {
  async getSession() {
    return storage.get<Session>(storageKeys.authSession);
  },
  async setSession(session: Session) {
    await storage.set(storageKeys.authSession, session);
  },
  async clearSession() {
    await storage.remove(storageKeys.authSession);
  },
};
