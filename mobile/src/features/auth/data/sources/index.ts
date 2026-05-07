import { apiClient } from '../../../../core/api/client';
import { endpoints } from '../../../../core/api/endpoints';
import { AppRole, Session } from '../../../../core/auth/session';
import { storageKeys } from '../../../../core/storage/keys';
import { storage } from '../../../../core/storage/storage';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  password_confirmation: string;
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

interface RefreshResponse {
  access: string;
  refresh?: string;
}

export interface RegisterResponse {
  message: string;
  user: BackendUser & {
    is_email_verified?: boolean;
    date_joined?: string;
  };
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
  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    const response = await apiClient.post<RegisterResponse>(`${endpoints.auth}/register/`, payload);

    if (!response) {
      throw new Error('Registration did not return a response payload.');
    }

    return response;
  },
  async verifyEmail(email: string, code: string): Promise<void> {
    await apiClient.post<void>(`${endpoints.auth}/verify-email/`, { email, code });
  },
  async resendVerificationCode(email: string): Promise<void> {
    await apiClient.post<void>(`${endpoints.auth}/resend-verification/`, { email });
  },
  async refresh(session: Session): Promise<Pick<Session, 'accessToken' | 'refreshToken'>> {
    const response = await apiClient.post<RefreshResponse>(
      `${endpoints.auth}/token/refresh/`,
      { refresh: session.refreshToken },
      { skipAuthRefresh: true },
    );

    if (!response?.access) {
      throw new Error('Token refresh did not return a new access token.');
    }

    return {
      accessToken: response.access,
      refreshToken: response.refresh ?? session.refreshToken,
    };
  },
  async logout(session: Session): Promise<void> {
    await apiClient.post<void>(
      `${endpoints.auth}/logout/`,
      { refresh: session.refreshToken },
      { token: session.accessToken, skipAuthRefresh: true },
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
