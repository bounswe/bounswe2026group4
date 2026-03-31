import { AuthSessionEntity } from '../../domain/entities';

export function mapAuth(value: unknown): AuthSessionEntity {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid auth payload.');
  }

  const payload = value as {
    token?: unknown;
    user?: {
      id?: unknown;
      name?: unknown;
      email?: unknown;
      role?: unknown;
    };
  };

  if (
    typeof payload.token !== 'string' ||
    !payload.user ||
    typeof payload.user.id !== 'string' ||
    typeof payload.user.name !== 'string' ||
    typeof payload.user.email !== 'string' ||
    (payload.user.role !== 'guest' && payload.user.role !== 'user' && payload.user.role !== 'admin')
  ) {
    throw new Error('Invalid auth payload.');
  }

  return {
    token: payload.token,
    user: {
      id: payload.user.id,
      name: payload.user.name,
      email: payload.user.email,
      role: payload.user.role,
    },
  };
}
