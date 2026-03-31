export interface ApiRequestConfig {
  url?: string;
  headers?: Record<string, string>;
  data?: unknown;
  params?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  config: ApiRequestConfig;
}

type RequestInterceptor = (config: ApiRequestConfig) => ApiRequestConfig | Promise<ApiRequestConfig>;
type ResponseFulfilledInterceptor = <T>(response: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>;
type ResponseRejectedInterceptor = (error: unknown) => unknown;

const requestHandlers = new Map<number, RequestInterceptor>();
const responseFulfilledHandlers = new Map<number, ResponseFulfilledInterceptor>();
const responseRejectedHandlers = new Map<number, ResponseRejectedInterceptor>();

let interceptorId = 0;

export const interceptors = {
  request: {
    use(handler: RequestInterceptor) {
      const id = ++interceptorId;
      requestHandlers.set(id, handler);

      return id;
    },
    eject(id: number) {
      requestHandlers.delete(id);
    },
  },
  response: {
    use(onFulfilled?: ResponseFulfilledInterceptor, onRejected?: ResponseRejectedInterceptor) {
      const id = ++interceptorId;

      if (onFulfilled) {
        responseFulfilledHandlers.set(id, onFulfilled);
      }

      if (onRejected) {
        responseRejectedHandlers.set(id, onRejected);
      }

      return id;
    },
    eject(id: number) {
      responseFulfilledHandlers.delete(id);
      responseRejectedHandlers.delete(id);
    },
  },
  async runRequest(config: ApiRequestConfig) {
    let nextConfig = config;

    for (const handler of requestHandlers.values()) {
      nextConfig = await handler(nextConfig);
    }

    return nextConfig;
  },
  async runResponse<T>(response: ApiResponse<T>) {
    let nextResponse = response as ApiResponse<unknown>;

    for (const handler of responseFulfilledHandlers.values()) {
      nextResponse = await handler(nextResponse);
    }

    return nextResponse as ApiResponse<T>;
  },
  async runResponseError(error: unknown) {
    let nextError = error;

    for (const handler of responseRejectedHandlers.values()) {
      nextError = await handler(nextError);
    }

    return nextError;
  },
  clear() {
    requestHandlers.clear();
    responseFulfilledHandlers.clear();
    responseRejectedHandlers.clear();
  },
};
