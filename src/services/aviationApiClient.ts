import { getAviationApiBaseUrl, getAviationAuthToken, isAviationApiEnabled } from './aviationRuntimeConfig';

export type AviationApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

function buildUrl(path: string): string {
  const baseUrl = getAviationApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export function buildQuery(params: Record<string, string | number | boolean | null | undefined | string[]>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => search.append(key, item));
      return;
    }
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function aviationApiRequest<T>(path: string, options: AviationApiRequestOptions = {}): Promise<T> {
  if (!isAviationApiEnabled()) throw new Error('Aviation API is not configured.');
  const token = getAviationAuthToken();
  const response = await fetch(buildUrl(path), {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: {
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Aviation API request failed (${response.status}) ${path}${details ? `: ${details}` : ''}`);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function tryAviationApiRequest<T>(path: string, options: AviationApiRequestOptions = {}): Promise<T | null> {
  if (!isAviationApiEnabled()) return null;
  try {
    return await aviationApiRequest<T>(path, options);
  } catch (error) {
    console.warn(error instanceof Error ? error.message : 'Aviation API request failed');
    return null;
  }
}
