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
  async login(payload: LoginPayload) {
    const response = await apiClient.post<LoginResponse>(`${endpoints.auth}/login/`, payload);
    return toSession(response);
  },
  async logout(session: Session) {
    await apiClient.post<void>(
      `${endpoints.auth}/logout/`,
      { refresh: session.refreshToken },
      session.accessToken,
    );
  },
};

export const authLocalSource = {
  getSession: () => storage.get<Session>(storageKeys.session),
  saveSession: (session: Session) => storage.set(storageKeys.session, session),
  clearSession: () => storage.remove(storageKeys.session),
};
