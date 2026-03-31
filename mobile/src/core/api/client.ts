import { ApiRequestConfig, ApiResponse, interceptors } from './interceptors';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type ApiTransport = <T>(method: HttpMethod, config: ApiRequestConfig) => Promise<ApiResponse<T>>;

const defaultTransport: ApiTransport = async <T>(_method: HttpMethod, config: ApiRequestConfig) => ({
  status: 200,
  data: null as T,
  config,
});

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
  get: async <T>(url: string, config?: Omit<ApiRequestConfig, 'url'>) => request<T>('GET', url, config),
  post: async <T>(url: string, data?: unknown, config?: Omit<ApiRequestConfig, 'url' | 'data'>) =>
    request<T>('POST', url, { ...config, data }),
  put: async <T>(url: string, data?: unknown, config?: Omit<ApiRequestConfig, 'url' | 'data'>) =>
    request<T>('PUT', url, { ...config, data }),
  delete: async <T>(url: string, config?: Omit<ApiRequestConfig, 'url'>) => request<T>('DELETE', url, config),
};
