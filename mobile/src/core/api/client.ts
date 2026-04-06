import { env } from '../../app/config/env';
import { AppError } from '../errors/AppError';
import { ApiRequestConfig, ApiResponse, interceptors } from './interceptors';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type ApiTransport = <T>(method: HttpMethod, config: ApiRequestConfig) => Promise<ApiResponse<T>>;
type RequestConfigInput = Omit<ApiRequestConfig, 'url' | 'data'> & { token?: string };
const REQUEST_TIMEOUT_MS = 15000;

function buildUrl(path: string) {
  if (!env.apiBaseUrl) {
    throw new AppError('EXPO_PUBLIC_API_BASE_URL is not configured. Set it in mobile/.env and restart Expo.');
  }

  const normalizedBaseUrl = env.apiBaseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === 'string') {
    const trimmedPayload = payload.trim();

    if (!trimmedPayload) {
      return fallback;
    }

    if (trimmedPayload.includes('DisallowedHost')) {
      return 'Backend rejected this device host. The mobile app can reach the server, but the server is not configured to accept requests from this network address yet.';
    }

    if (trimmedPayload.startsWith('<!DOCTYPE') || trimmedPayload.startsWith('<html')) {
      return 'Server returned an unexpected HTML response instead of JSON.';
    }

    return trimmedPayload;
  }

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

function parseResponseBody(raw: string, contentType: string | null) {
  if (!raw) {
    return null;
  }

  if (contentType?.includes('application/json')) {
    return JSON.parse(raw) as unknown;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

const defaultTransport: ApiTransport = async <T>(method: HttpMethod, config: ApiRequestConfig) => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(config.headers ?? {}),
  };

  let body: BodyInit | undefined;

  if (isFormData(config.data)) {
    body = config.data;
  } else if (config.data != null) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(config.data);
  }

  const response = await fetch(buildUrl(config.url ?? ''), {
    method,
    headers,
    body,
  });

  const raw = await response.text();
  const payload = parseResponseBody(raw, response.headers.get('content-type'));
  const apiResponse: ApiResponse<T> = {
    status: response.status,
    data: payload as T,
    config,
  };

  if (!response.ok) {
    const error = new AppError(getErrorMessage(payload, 'Request failed.')) as AppError & {
      response: ApiResponse<unknown>;
    };
    error.response = apiResponse;
    throw error;
  }

  return apiResponse;
};

let transport: ApiTransport = defaultTransport;

async function request<T>(
  method: HttpMethod,
  url: string,
  config: Omit<ApiRequestConfig, 'url'> = {},
): Promise<T | null> {
  const preparedConfig = await interceptors.runRequest({
    ...config,
    url,
    headers: { ...(config.headers ?? {}) },
  });

  try {
    const response = await transport<T>(method, preparedConfig);
    const finalResponse = await interceptors.runResponse(response);

    return (finalResponse.data ?? null) as T | null;
  } catch (error) {
    const appError = error as AppError & { response?: ApiResponse<unknown> };

    if (!appError.response) {
      const normalizedError =
        appError.name === 'AbortError'
          ? new AppError(
              'Request timed out. Please check that your phone and computer are on the same Wi-Fi and try again.',
            )
          : new AppError(
              'Unable to reach the backend. Check mobile/.env, confirm EXPO_PUBLIC_API_BASE_URL, and make sure the backend is running and reachable from your phone.',
            );

      await interceptors.runResponseError(normalizedError);
      throw normalizedError;
    }

    await interceptors.runResponseError(error);
    throw error;
  }
}

export function setApiTransport(nextTransport: ApiTransport) {
  transport = nextTransport;
}

export function resetApiTransport() {
  transport = defaultTransport;
}

export const apiClient = {
  get: async <T>(url: string, tokenOrConfig?: string | RequestConfigInput) =>
    request<T>('GET', url, normalizeConfig(tokenOrConfig)),
  post: async <T>(
    url: string,
    data?: unknown,
    tokenOrConfig?: string | RequestConfigInput,
  ) =>
    request<T>('POST', url, { ...normalizeConfig(tokenOrConfig), data }),
  put: async <T>(
    url: string,
    data?: unknown,
    tokenOrConfig?: string | RequestConfigInput,
  ) =>
    request<T>('PUT', url, { ...normalizeConfig(tokenOrConfig), data }),
  patch: async <T>(
    url: string,
    data?: unknown,
    tokenOrConfig?: string | RequestConfigInput,
  ) =>
    request<T>('PATCH', url, { ...normalizeConfig(tokenOrConfig), data }),
  delete: async <T>(url: string, tokenOrConfig?: string | RequestConfigInput) =>
    request<T>('DELETE', url, normalizeConfig(tokenOrConfig)),
};

function normalizeConfig(tokenOrConfig?: string | RequestConfigInput): Omit<ApiRequestConfig, 'url'> {
  if (!tokenOrConfig) {
    return {};
  }

  if (typeof tokenOrConfig === 'string') {
    return {
      headers: {
        Authorization: `Bearer ${tokenOrConfig}`,
      },
    };
  }

  if (tokenOrConfig.token && typeof tokenOrConfig.token === 'string') {
    const { token, ...rest } = tokenOrConfig;

    return {
      ...rest,
      headers: {
        ...(rest.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    };
  }

  return tokenOrConfig;
}
