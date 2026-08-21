/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEFAULT_API_BASE_URL, resolveRuntimeUrl } from './public-runtime-config';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  error?: {
    code?: string;
    message?: string;
  };
};

type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

type ApiClientOptions = {
  baseUrl?: string;
  getToken?: () => string | null;
};

const importMeta = import.meta as ImportMeta & {
  env?: {
    VITE_API_BASE_URL?: string;
  };
};

const defaultBaseUrl = resolveRuntimeUrl(importMeta.env?.VITE_API_BASE_URL, DEFAULT_API_BASE_URL);

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

export const createApiClient = ({ baseUrl = defaultBaseUrl, getToken }: ApiClientOptions = {}) => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  const request = async <T>(path: string, init: RequestInit = {}) => {
    const token = getToken?.();
    const headers = new Headers(init.headers);

    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json');
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${normalizedBaseUrl}${path}`, {
      ...init,
      headers,
    });

    let payload: ApiEnvelope<T> | null = null;

    try {
      payload = (await response.json()) as ApiEnvelope<T>;
    } catch {
      payload = null;
    }

    if (!response.ok || payload?.success === false) {
      const error = payload && 'error' in payload ? payload.error : undefined;
      throw new ApiError(
        response.status,
        error?.code ?? 'REQUEST_FAILED',
        error?.message ?? `请求失败，状态码 ${response.status}`,
      );
    }

    if (!payload || payload.success !== true) {
      throw new ApiError(response.status, 'INVALID_API_RESPONSE', '接口响应格式不正确');
    }

    return payload.data;
  };

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    patch: <T>(path: string, body: unknown) =>
      request<T>(path, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: <T>(path: string) =>
      request<T>(path, {
        method: 'DELETE',
      }),
  };
};

export type ApiClient = ReturnType<typeof createApiClient>;
