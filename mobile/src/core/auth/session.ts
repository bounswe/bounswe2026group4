export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'guest' | 'user' | 'admin';
}

export interface Session {
  user?: AuthUser;
  token?: string;
  accessToken?: string;
  role?: 'guest' | 'user' | 'admin';
}
