import { AuthSessionEntity } from '../entities';

export interface AuthRepository {
  login(email: string, password: string): Promise<AuthSessionEntity>;
  restore(): Promise<AuthSessionEntity | null>;
  logout(): Promise<void>;
}
