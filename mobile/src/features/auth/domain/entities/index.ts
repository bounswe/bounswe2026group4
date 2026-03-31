import { AuthUser } from '../../../../core/auth/session';

export interface AuthSessionEntity {
  token: string;
  user: AuthUser;
}
