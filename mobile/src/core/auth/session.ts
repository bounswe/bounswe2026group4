export interface Session {
  accessToken?: string;
  role?: 'guest' | 'user' | 'admin';
}
