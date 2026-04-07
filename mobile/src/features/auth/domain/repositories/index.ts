import { AuthSessionEntity } from '../entities';

export interface RegisterUserInput {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterUserResult {
  message: string;
}

export interface AuthRepository {
  login(email: string, password: string): Promise<AuthSessionEntity>;
  register(input: RegisterUserInput): Promise<RegisterUserResult>;
  restore(): Promise<AuthSessionEntity | null>;
  refresh(session: AuthSessionEntity): Promise<AuthSessionEntity>;
  logout(session?: AuthSessionEntity | null): Promise<void>;
  updateUser(user: AuthSessionEntity['user']): Promise<AuthSessionEntity | null>;
  clear(): Promise<void>;
}
