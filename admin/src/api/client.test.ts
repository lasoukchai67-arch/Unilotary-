import { describe, expect, it, vi } from 'vitest';
import { ApiClient, buildQuery } from './client';
import { ApiError, codeForStatus, toApiError } from './errors';
import { createTokenStore, REFRESH_TOKEN_KEY } from './tokens';
import type { AuthResponse, User } from './types';

// ---------- helpers: contract-shaped responses ----------
const user = (over: Partial<User> = {}): User => ({
  id: 3,
  phone: '02055551234',
  fullName: 'ສົມໃຈ',
  role: 'admin',
  kyc: 'verified',
  kycNote: null,
  status: 'active',
  pinSet: true,
  dailySpendCap: null,
  selfExcludedUntil: null,
  balance: 0,
  held: 0,
  commissionBp: 0,
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});

const session = (n: number): AuthResponse => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}-xxxxxxxxxxxxxxxxxxxx`,
  expiresInSec: 900,
  user: user(),
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const apiError = (status: number, error: string, message: string, details?: unknown) =>
  json(status, details === undefined ? { error, message } : { error, message, details });

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function setup(handler: Handler, opts: { access?: string | null; refresh?: string | null } = {}) {
  const tokens = createTokenStore(window.sessionStorage);
  if (opts.refresh !== null) tokens.setTokens(opts.access ?? 'access-0', opts.refresh ?? 'refresh-0-xxxxxxxxxxxxxxxxxxxx');
  if (opts.access === null) {
    // simulate a page reload: refresh token survives, access token does not
    const rt = tokens.getRefreshToken();
    tokens.clear();
    if (rt) window.sessionStorage.setItem(REFRESH_TOKEN_KEY, rt);
  }
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(handler(String(input), init ?? {})));
  const onAuthLost = vi.fn();
  const onSession = vi.fn();
  const client = new ApiClient({ baseUrl: '/v1', tokens, fetch: fetchMock as unknown as typeof fetch, onAuthLost, onSession });
  return { client, tokens, fetchMock, onAuthLost, onSession };
}

const authHeader = (init: RequestInit) => (init.headers as Record<string, string>).Authorization;
const bodyOf = (init: RequestInit) => JSON.parse(String(init.body));

// ---------- tests ----------
describe('buildQuery', () => {
  it('skips empty values and encodes the rest', () => {
    expect(buildQuery({ status: 'open', before: undefined, q: '', role: null, limit: 20 })).toBe('?status=open&limit=20');
    expect(buildQuery({ q: 'ສົມ ໃຈ' })).toBe('?q=%E0%BA%AA%E0%BA%BB%E0%BA%A1+%E0%BB%83%E0%BA%88');
    expect(buildQuery({})).toBe('');
  });
});

describe('ApiClient requests', () => {
  it('sends the bearer token, JSON body and parses the JSON response', async () => {
    const { client, fetchMock } = setup(() => json(200, { key: 'deposit_min', value: 20000 }));
    const res = await client.request<{ key: string; value: number }>('/admin/settings/deposit_min', {
      method: 'PUT',
      body: { value: 20000 },
    });
    expect(res).toEqual({ key: 'deposit_min', value: 20000 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/v1/admin/settings/deposit_min');
    expect(init?.method).toBe('PUT');
    expect(authHeader(init!)).toBe('Bearer access-0');
    expect((init!.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(bodyOf(init!)).toEqual({ value: 20000 });
  });

  it('does not send a Content-Type or body when there is no body (Fastify rejects empty JSON)', async () => {
    const { client, fetchMock } = setup(() => json(200, { id: 1 }));
    await client.request('/admin/payouts/1/approve', { method: 'POST' });
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('returns undefined for 204 No Content', async () => {
    const { client } = setup(() => new Response(null, { status: 204 }));
    await expect(client.request('/admin/draws/7/numbers/27/limit', { method: 'PUT', body: {} })).resolves.toBeUndefined();
  });

  it('does not attach the token to auth:false requests', async () => {
    const { client, fetchMock } = setup(() => json(200, { expiresInSec: 300, devCode: '123456' }));
    await client.request('/auth/otp/request', { method: 'POST', body: { phone: '02055551234' }, auth: false });
    expect(authHeader(fetchMock.mock.calls[0][1]!)).toBeUndefined();
  });

  it('returns a Blob for responseType blob', async () => {
    const { client } = setup(() => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/png' } }));
    const blob = await client.request<Blob>('/admin/kyc/5/document', { responseType: 'blob' });
    expect(blob.size).toBe(3);
  });
});

describe('error mapping', () => {
  it('maps the contract error body {error, message, details}', async () => {
    const details = [{ number: '27', reason: 'full', remaining: 0 }];
    const { client } = setup(() => apiError(409, 'NUMBER_LIMIT', 'ເລກ 27 ເຕັມແລ້ວ', details));
    const err = await client.request('/x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: 'NUMBER_LIMIT', message: 'ເລກ 27 ເຕັມແລ້ວ', details });
  });

  it('shows the server message for FORBIDDEN (e.g. approving your own withdrawal) without logging out', async () => {
    const { client, onAuthLost, fetchMock } = setup(() =>
      apiError(403, 'FORBIDDEN', 'ອະນຸມັດການຖອນເງິນຂອງຕົນເອງບໍ່ໄດ້'),
    );
    const err = await client.request('/admin/withdrawals/4/approve', { method: 'POST' }).catch((e) => e);
    expect(err).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'ອະນຸມັດການຖອນເງິນຂອງຕົນເອງບໍ່ໄດ້' });
    expect(onAuthLost).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to a code from the HTTP status and a Lao message for non-JSON bodies', async () => {
    const { client } = setup(() => new Response('<html>Bad Gateway</html>', { status: 502 }));
    const err = (await client.request('/x').catch((e) => e)) as ApiError;
    expect(err).toMatchObject({ status: 502, code: 'PROVIDER_ERROR' });
    expect(err.message).toMatch(/[຀-໿]/); // Lao text
  });

  it('maps a network failure to code NETWORK', async () => {
    const { client } = setup(() => {
      throw new TypeError('Failed to fetch');
    });
    const err = await client.request('/x').catch((e) => e);
    expect(err).toMatchObject({ status: 0, code: 'NETWORK' });
  });

  it('keeps unknown server codes and uses a fallback message when message is missing', () => {
    expect(toApiError(418, { error: 'TEAPOT' })).toMatchObject({ code: 'TEAPOT', status: 418 });
    expect(toApiError(429, { error: 'RATE_LIMITED', message: '' }).message).toBe('ສົ່ງຄຳຂໍຖີ່ເກີນໄປ ກະລຸນາລໍຖ້າແລ້ວລອງໃໝ່');
    expect(codeForStatus(400)).toBe('VALIDATION');
    expect(codeForStatus(401)).toBe('UNAUTHORIZED');
    expect(codeForStatus(404)).toBe('NOT_FOUND');
    expect(codeForStatus(500)).toBe('INTERNAL');
  });
});

describe('refresh on 401', () => {
  it('refreshes once, stores the rotated refresh token and retries with the new access token', async () => {
    const { client, fetchMock, tokens, onSession, onAuthLost } = setup((url, init) => {
      if (url === '/v1/auth/refresh') return json(200, session(1));
      return authHeader(init) === 'Bearer access-1' ? json(200, { ok: true }) : apiError(401, 'UNAUTHORIZED', 'session ໝົດອາຍຸ');
    });

    await expect(client.request('/admin/dashboard')).resolves.toEqual({ ok: true });

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual(['/v1/admin/dashboard', '/v1/auth/refresh', '/v1/admin/dashboard']);
    const refreshInit = fetchMock.mock.calls[1][1]!;
    expect(bodyOf(refreshInit)).toEqual({ refreshToken: 'refresh-0-xxxxxxxxxxxxxxxxxxxx' });
    expect(authHeader(refreshInit)).toBeUndefined();

    expect(tokens.getAccessToken()).toBe('access-1');
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1-xxxxxxxxxxxxxxxxxxxx');
    expect(onSession).toHaveBeenCalledWith(session(1));
    expect(onAuthLost).not.toHaveBeenCalled();
  });

  it('uses the rotated refresh token for the next refresh', async () => {
    let n = 0;
    const { client, fetchMock, tokens } = setup(() => json(200, session(++n)));
    await client.refresh();
    await client.refresh();
    expect(tokens.getAccessToken()).toBe('access-2');
    const refreshBodies = fetchMock.mock.calls.filter((c) => String(c[0]) === '/v1/auth/refresh').map((c) => bodyOf(c[1]!));
    expect(refreshBodies).toEqual([
      { refreshToken: 'refresh-0-xxxxxxxxxxxxxxxxxxxx' },
      { refreshToken: 'refresh-1-xxxxxxxxxxxxxxxxxxxx' },
    ]);
  });

  it('is single-flight: concurrent 401s share one refresh request', async () => {
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((r) => (releaseRefresh = r));
    const { client, fetchMock } = setup(async (url, init) => {
      if (url === '/v1/auth/refresh') {
        await refreshGate;
        return json(200, session(1));
      }
      return authHeader(init) === 'Bearer access-1' ? json(200, { url }) : apiError(401, 'UNAUTHORIZED', 'x');
    });

    const all = Promise.all([client.request('/a'), client.request('/b'), client.request('/c')]);
    await vi.waitFor(() => expect(fetchMock.mock.calls.filter((c) => String(c[0]) === '/v1/auth/refresh')).toHaveLength(1));
    releaseRefresh();
    await expect(all).resolves.toEqual([{ url: '/v1/a' }, { url: '/v1/b' }, { url: '/v1/c' }]);
    expect(fetchMock.mock.calls.filter((c) => String(c[0]) === '/v1/auth/refresh')).toHaveLength(1);
  });

  it('a request that fails after another one already refreshed retries without refreshing again', async () => {
    let slowRelease!: () => void;
    const slowGate = new Promise<void>((r) => (slowRelease = r));
    const { client, fetchMock } = setup(async (url, init) => {
      if (url === '/v1/auth/refresh') return json(200, session(1));
      if (url === '/v1/slow' && authHeader(init) === 'Bearer access-0') {
        await slowGate; // answered with 401 only after /fast has refreshed
        return apiError(401, 'UNAUTHORIZED', 'x');
      }
      return authHeader(init) === 'Bearer access-1' ? json(200, { url }) : apiError(401, 'UNAUTHORIZED', 'x');
    });
    const slow = client.request('/slow');
    await client.request('/fast');
    slowRelease();
    await expect(slow).resolves.toEqual({ url: '/v1/slow' });
    expect(fetchMock.mock.calls.filter((c) => String(c[0]) === '/v1/auth/refresh')).toHaveLength(1);
  });

  it('restores the session after a reload (no access token in memory)', async () => {
    const { client, fetchMock } = setup(
      (url, init) => {
        if (url === '/v1/auth/refresh') return json(200, session(1));
        return authHeader(init) === 'Bearer access-1' ? json(200, { ok: true }) : apiError(401, 'UNAUTHORIZED', 'x');
      },
      { access: null },
    );
    await expect(client.request('/me')).resolves.toEqual({ ok: true });
    expect(authHeader(fetchMock.mock.calls[0][1]!)).toBeUndefined();
  });

  it('clears tokens and reports auth lost when the refresh token is rejected', async () => {
    const { client, tokens, onAuthLost, fetchMock } = setup((url) =>
      url === '/v1/auth/refresh' ? apiError(401, 'UNAUTHORIZED', 'ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່') : apiError(401, 'UNAUTHORIZED', 'x'),
    );
    const err = await client.request('/admin/dashboard').catch((e) => e);
    expect(err).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(onAuthLost).toHaveBeenCalledTimes(1);
    expect(tokens.getAccessToken()).toBeNull();
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2); // original + refresh, no retry
  });

  it('treats a suspended account (refresh -> 403) as auth lost', async () => {
    const { client, onAuthLost } = setup((url) =>
      url === '/v1/auth/refresh' ? apiError(403, 'FORBIDDEN', 'ບັນຊີຖືກລະງັບ') : apiError(401, 'UNAUTHORIZED', 'x'),
    );
    await expect(client.request('/me')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(onAuthLost).toHaveBeenCalledTimes(1);
  });

  it('keeps the tokens when the refresh fails for a transient reason (5xx / network)', async () => {
    const { client, tokens, onAuthLost } = setup((url) =>
      url === '/v1/auth/refresh' ? apiError(500, 'INTERNAL', 'ລະບົບຂັດຂ້ອງ') : apiError(401, 'UNAUTHORIZED', 'x'),
    );
    await expect(client.request('/me')).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(onAuthLost).not.toHaveBeenCalled();
    expect(tokens.getRefreshToken()).toBe('refresh-0-xxxxxxxxxxxxxxxxxxxx');
  });

  it('gives up (auth lost) when the retried request is still 401, without a second refresh', async () => {
    const { client, onAuthLost, fetchMock } = setup((url) =>
      url === '/v1/auth/refresh' ? json(200, session(1)) : apiError(401, 'UNAUTHORIZED', 'x'),
    );
    await expect(client.request('/me')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toEqual(['/v1/me', '/v1/auth/refresh', '/v1/me']);
    expect(onAuthLost).toHaveBeenCalledTimes(1);
  });

  it('does not refresh for 401 PIN errors', async () => {
    const { client, fetchMock, onAuthLost } = setup(() => apiError(401, 'PIN_INVALID', 'PIN ບໍ່ຖືກຕ້ອງ'));
    await expect(client.request('/me/pin', { method: 'POST', body: { pin: '1' } })).rejects.toMatchObject({ code: 'PIN_INVALID' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onAuthLost).not.toHaveBeenCalled();
  });

  it('does not refresh for unauthenticated endpoints (wrong OTP is a 401 too)', async () => {
    const { client, fetchMock, onAuthLost } = setup(() => apiError(401, 'UNAUTHORIZED', 'ລະຫັດບໍ່ຖືກຕ້ອງ'));
    await expect(
      client.request('/auth/otp/verify', { method: 'POST', body: { phone: '02055551234', code: '000000' }, auth: false }),
    ).rejects.toMatchObject({ message: 'ລະຫັດບໍ່ຖືກຕ້ອງ' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onAuthLost).not.toHaveBeenCalled();
  });

  it('reports auth lost immediately when there is no refresh token at all', async () => {
    const { client, fetchMock, onAuthLost } = setup(() => apiError(401, 'UNAUTHORIZED', 'x'), { refresh: null });
    await expect(client.request('/me')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onAuthLost).toHaveBeenCalledTimes(1);
  });
});

describe('token store', () => {
  it('keeps the access token in memory only and the refresh token in sessionStorage', () => {
    const tokens = createTokenStore(window.sessionStorage);
    tokens.setTokens('acc', 'ref');
    expect(tokens.getAccessToken()).toBe('acc');
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe('ref');
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain('acc');
    expect(window.localStorage.length).toBe(0);
    tokens.clear();
    expect(tokens.getAccessToken()).toBeNull();
    expect(tokens.getRefreshToken()).toBeNull();
  });

  it('falls back to memory when storage is unavailable', () => {
    const tokens = createTokenStore(null);
    tokens.setTokens('a', 'r');
    expect(tokens.getRefreshToken()).toBe('r');
  });
});
