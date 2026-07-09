import { LOCALE_STORAGE_KEY } from '../i18n';

const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly canResend?: boolean,
    public readonly data?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      'Accept-Language': localStorage.getItem(LOCALE_STORAGE_KEY) || 'pt',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    // Email verification errors must not trigger a token refresh
    // API returns { code, canResend } directly at the top level
    if (body?.code) {
      throw new ApiError(body.code, 401, body.code, body.canResend);
    }
    // Legacy: message wrapper format { message: { code, canResend } }
    const msg = body?.message;
    if (msg && typeof msg === 'object' && msg.code) {
      throw new ApiError(msg.code, 401, msg.code, msg.canResend);
    }
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, options);
    localStorage.clear();
    window.dispatchEvent(new CustomEvent('auth:logout'));
    throw new ApiError('Unauthorized', 401);
  }

  if (res.status === 503) {
    const err = await res.json().catch(() => ({}));
    window.dispatchEvent(new CustomEvent('platform:maintenance', { detail: err.message }));
    throw new ApiError(err.message || 'Plataforma em manutenção', 503);
  }

  if (res.status === 403) {
    const err = await res.json().catch(() => ({}));
    const isBan = typeof err.message === 'string' && err.message.includes('suspensa');
    if (isBan) {
      window.dispatchEvent(new CustomEvent('account:banned', { detail: err.message }));
    }
    throw new ApiError(err.message || 'Acesso negado', 403);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(err.message || 'Request failed', res.status, err.code, undefined, err);
  }

  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return true;
  } catch { return false; }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'DELETE', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }),
  upload: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }),
};
