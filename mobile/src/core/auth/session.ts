export type AppRole = 'guest' | 'user' | 'admin';

export interface SessionUser {
  id: number;
  email: string;
  username: string;
  role: AppRole;
  isUsernamePublic?: boolean;
}

export type AuthUser = SessionUser;

export interface Session {
  accessToken: string;
  refreshToken: string;
  role: AppRole;
  user: SessionUser;
}
