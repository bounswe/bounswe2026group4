import { env } from '../../app/config/env';
import { AppError } from '../errors/AppError';

interface RequestOptions {
  body?: unknown;
  token?: string;
}

function buildUrl(path: string) {
  if (!env.apiBaseUrl) {
    throw new AppError('EXPO_PUBLIC_API_BASE_URL is not configured.');
  }

  const normalizedBaseUrl = env.apiBaseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.message === 'string') {
    return record.message;
  }

  if (typeof record.detail === 'string') {
    return record.detail;
  }

  if (Array.isArray(record.non_field_errors) && typeof record.non_field_errors[0] === 'string') {
    return record.non_field_errors[0];
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
    }

    if (typeof value === 'string') {
      return value;
    }
  }

  return fallback;
}

async function request<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const raw = await response.text();
  const payload = raw ? (JSON.parse(raw) as unknown) : null;

  if (!response.ok) {
    throw new AppError(getErrorMessage(payload, 'Request failed.'));
  }

  return payload as T;
}

export const apiClient = {
  get: <T>(path: string, token?: string) => request<T>('GET', path, { token }),
  post: <T>(path: string, body?: unknown, token?: string) =>
    request<T>('POST', path, { body, token }),
  put: <T>(path: string, body?: unknown, token?: string) =>
    request<T>('PUT', path, { body, token }),
  delete: <T>(path: string, body?: unknown, token?: string) =>
    request<T>('DELETE', path, { body, token }),
};
