import { ApiError, FALLBACK_MESSAGES, networkError, toApiError } from './errors';
import type { TokenStore } from './tokens';
import type { AuthResponse } from './types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: HttpMethod;
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Send the access token and renew it on 401. Default true. */
  auth?: boolean;
  signal?: AbortSignal;
  responseType?: 'json' | 'blob';
  headers?: Record<string, string>;
}

export interface ApiClientOptions {
  baseUrl: string;
  tokens: TokenStore;
  fetch?: typeof fetch;
  /** Called when the session cannot be renewed (tokens are already cleared). */
  onAuthLost?: () => void;
  /** Called after a successful refresh with the new session (user may have changed). */
  onSession?: (session: AuthResponse) => void;
}

export function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

function joinUrl(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return b + p;
}

function isAbort(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';
}

/** A 401 that a token refresh can fix (PIN_REQUIRED / PIN_INVALID are also 401 but must not refresh). */
function isExpiredSession(err: ApiError): boolean {
  return err.status === 401 && err.code === 'UNAUTHORIZED';
}

export class ApiClient {
  readonly baseUrl: string;
  readonly tokens: TokenStore;
  private readonly fetchImpl: typeof fetch;
  private onAuthLost?: () => void;
  private onSession?: (session: AuthResponse) => void;
  private refreshInFlight: Promise<AuthResponse> | null = null;

  constructor(opts: ApiClientOptions) {
    this.baseUrl = opts.baseUrl;
    this.tokens = opts.tokens;
    // Bind so that `window.fetch` is not called with a wrong `this`.
    this.fetchImpl = opts.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.onAuthLost = opts.onAuthLost;
    this.onSession = opts.onSession;
  }

  setHandlers(h: Pick<ApiClientOptions, 'onAuthLost' | 'onSession'>): void {
    this.onAuthLost = h.onAuthLost;
    this.onSession = h.onSession;
  }

  url(path: string, query?: Record<string, QueryValue>): string {
    return joinUrl(this.baseUrl, path) + buildQuery(query);
  }

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const auth = opts.auth !== false;
    const tokenUsed = auth ? this.tokens.getAccessToken() : null;
    const res = await this.send(path, opts, tokenUsed);
    if (res.ok) return this.parse<T>(res, opts);

    const err = await this.errorFrom(res);
    if (!auth || !isExpiredSession(err)) throw err;

    // Session expired: renew once (shared between concurrent callers), then retry once.
    const current = this.tokens.getAccessToken();
    const freshToken =
      current && current !== tokenUsed
        ? current // another request already refreshed while this one was in flight
        : (await this.refresh()).accessToken;

    const retry = await this.send(path, opts, freshToken);
    if (retry.ok) return this.parse<T>(retry, opts);
    const retryErr = await this.errorFrom(retry);
    if (isExpiredSession(retryErr)) this.authLost();
    throw retryErr;
  }

  /**
   * POST /auth/refresh with the stored refresh token. Single-flight: concurrent calls share
   * one network request, which matters because the server rotates the refresh token on every use.
   */
  refresh(): Promise<AuthResponse> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.doRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  /** Forget the session locally and notify the app (redirects to login). */
  authLost(): void {
    this.tokens.clear();
    this.onAuthLost?.();
  }

  private async doRefresh(): Promise<AuthResponse> {
    const refreshToken = this.tokens.getRefreshToken();
    if (!refreshToken) {
      this.authLost();
      throw new ApiError(401, 'UNAUTHORIZED', FALLBACK_MESSAGES.UNAUTHORIZED);
    }
    const res = await this.send('/auth/refresh', { method: 'POST', body: { refreshToken } }, null);
    if (!res.ok) {
      const err = await this.errorFrom(res);
      // The refresh token is invalid/expired/revoked: the session is over.
      // 429 and 5xx are transient, keep the tokens so the user can retry.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) this.authLost();
      throw err;
    }
    const session = await this.parse<AuthResponse>(res, {});
    if (!session || typeof session.accessToken !== 'string' || typeof session.refreshToken !== 'string') {
      this.authLost();
      throw new ApiError(res.status, 'BAD_RESPONSE', FALLBACK_MESSAGES.BAD_RESPONSE);
    }
    this.tokens.setTokens(session.accessToken, session.refreshToken);
    this.onSession?.(session);
    return session;
  }

  private async send(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: opts.responseType === 'blob' ? '*/*' : 'application/json',
      ...opts.headers,
    };
    let body: BodyInit | undefined;
    if (opts.body !== undefined) {
      if (typeof FormData !== 'undefined' && opts.body instanceof FormData) {
        body = opts.body;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(opts.body);
      }
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      return await this.fetchImpl(this.url(path, opts.query), {
        method: opts.method ?? 'GET',
        headers,
        body,
        signal: opts.signal,
      });
    } catch (e) {
      if (isAbort(e)) throw e;
      throw networkError(e);
    }
  }

  private async parse<T>(res: Response, opts: RequestOptions): Promise<T> {
    if (res.status === 204) return undefined as T;
    if (opts.responseType === 'blob') return (await res.blob()) as T;
    const text = await res.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(res.status, 'BAD_RESPONSE', FALLBACK_MESSAGES.BAD_RESPONSE);
    }
  }

  private async errorFrom(res: Response): Promise<ApiError> {
    let body: unknown = null;
    try {
      const text = await res.text();
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return toApiError(res.status, body);
  }
}
