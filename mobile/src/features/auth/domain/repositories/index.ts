import { AuthSessionEntity } from '../entities';

export interface AuthRepository {
  login(email: string, password: string): Promise<AuthSessionEntity>;
  restore(): Promise<AuthSessionEntity | null>;
  logout(session?: AuthSessionEntity | null): Promise<void>;
  clear(): Promise<void>;
}
