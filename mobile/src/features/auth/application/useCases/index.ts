import { Session } from '../../../../core/auth/session';
import { authService } from '../services';

interface LoginInput {
  email: string;
  password: string;
}

export async function loginWithEmailPassword(input: LoginInput): Promise<Session> {
  return authService.login({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
}

export async function restoreAuthSession() {
  return authService.restoreSession();
}

export async function logoutCurrentUser(session: Session) {
  return authService.logout(session);
}
