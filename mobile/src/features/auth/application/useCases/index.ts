import { Session } from '../../../../core/auth/session';
import { authService } from '../services';

interface LoginInput {
  email: string;
  password: string;
}

export async function loginWithEmailPassword(input: LoginInput): Promise<Session> {
  return authService.login(input.email.trim().toLowerCase(), input.password);
}

export async function restoreAuthSession() {
  return authService.restore();
}

export async function logoutCurrentUser(session: Session) {
  return authService.logout(session);
}
