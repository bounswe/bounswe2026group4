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
  logout(session?: AuthSessionEntity | null): Promise<void>;
  clear(): Promise<void>;
}
