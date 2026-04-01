import { AuthSessionEntity } from '../../domain/entities';

export function mapAuth(value: unknown): AuthSessionEntity {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid auth payload.');
  }

  const payload = value as {
    accessToken?: unknown;
    refreshToken?: unknown;
    role?: unknown;
    user?: {
      id?: unknown;
      username?: unknown;
      email?: unknown;
      role?: unknown;
    };
  };

  if (
    typeof payload.accessToken !== 'string' ||
    typeof payload.refreshToken !== 'string' ||
    (payload.role !== 'user' && payload.role !== 'admin' && payload.role !== 'guest') ||
    !payload.user ||
    typeof payload.user.id !== 'number' ||
    typeof payload.user.username !== 'string' ||
    typeof payload.user.email !== 'string' ||
    (payload.user.role !== 'guest' && payload.user.role !== 'user' && payload.user.role !== 'admin')
  ) {
    throw new Error('Invalid auth payload.');
  }

  return {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    role: payload.role,
    user: {
      id: payload.user.id,
      username: payload.user.username,
      email: payload.user.email,
      role: payload.user.role,
    },
  };
}
