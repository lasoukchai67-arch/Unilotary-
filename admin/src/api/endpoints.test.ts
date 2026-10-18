import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from './client';
import { createApi } from './endpoints';
import { createTokenStore } from './tokens';

function setup(response: () => Response = () => new Response(JSON.stringify({ items: [], nextBefore: null }), { status: 200 })) {
  const tokens = createTokenStore(window.sessionStorage);
  tokens.setTokens('acc', 'ref-xxxxxxxxxxxxxxxxxxxxxx');
  const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(response()));
  const api = createApi(new ApiClient({ baseUrl: '/v1', tokens, fetch: fetchMock as unknown as typeof fetch }));
  const call = (i = 0) => {
    const [url, init] = fetchMock.mock.calls[i];
    return { url: String(url), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined };
  };
  return { api, tokens, fetchMock, call };
}

describe('endpoint paths and bodies follow docs/API.md', () => {
  it('lists with before/limit cursors and filters', async () => {
    const { api, call } = setup();
    await api.admin.draws.list({ status: 'closed', before: 40, limit: 20 });
    expect(call()).toMatchObject({ url: '/v1/admin/draws?status=closed&limit=20&before=40', method: 'GET' });
    await api.admin.withdrawals.list({});
    expect(call(1).url).toBe('/v1/admin/withdrawals?status=requested');
    await api.admin.users.list({ q: '  0205 ', role: 'agent' });
    expect(call(2).url).toBe('/v1/admin/users?q=0205&role=agent');
    await api.admin.kyc.list();
    expect(call(3).url).toBe('/v1/admin/kyc?status=pending');
    await api.admin.payouts.list({ before: 9 });
    expect(call(4).url).toBe('/v1/admin/payouts?status=pending&before=9');
    await api.admin.audit.list({ limit: 50 });
    expect(call(5).url).toBe('/v1/admin/audit?limit=50');
  });

  it('draw management', async () => {
    const { api, call } = setup(() => new Response('{}', { status: 200 }));
    const body = {
      drawNo: '0124',
      drawDate: '2026-10-21',
      salesOpenAt: '2026-10-19T01:00:00.000Z',
      salesCloseAt: '2026-10-21T13:00:00.000Z',
      rules: [{ digits: 2 as const, payoutRate: 60, minAmount: 1000, maxPerLine: 100000, defaultNumberCap: 1000000 }],
    };
    await api.admin.draws.create(body);
    expect(call(0)).toEqual({ url: '/v1/admin/draws', method: 'POST', body });
    await api.admin.draws.cancel(7, 'ສະພາບອາກາດ');
    expect(call(1)).toEqual({ url: '/v1/admin/draws/7/cancel', method: 'POST', body: { reason: 'ສະພາບອາກາດ' } });
    await api.admin.draws.exposure(7, 3, 100);
    expect(call(2).url).toBe('/v1/admin/draws/7/exposure?digits=3&limit=100');
    await api.admin.draws.setNumberLimit(7, '027', { cap: null, payoutRate: 55.5, closed: true });
    expect(call(3)).toEqual({
      url: '/v1/admin/draws/7/numbers/027/limit',
      method: 'PUT',
      body: { cap: null, payoutRate: 55.5, closed: true },
    });
    await api.admin.draws.open(7);
    await api.admin.draws.close(7);
    expect(call(4)).toEqual({ url: '/v1/admin/draws/7/open', method: 'POST', body: {} });
    expect(call(5)).toEqual({ url: '/v1/admin/draws/7/close', method: 'POST', body: {} });
  });

  it('results maker–checker', async () => {
    const { api, call } = setup(() => new Response('{}', { status: 200 }));
    await api.admin.draws.enterResult(7, '482175');
    await api.admin.draws.approveResult(7, '482175');
    await api.admin.draws.rejectResult(7);
    expect(call(0)).toEqual({ url: '/v1/admin/draws/7/result', method: 'POST', body: { resultNumber: '482175' } });
    expect(call(1)).toEqual({ url: '/v1/admin/draws/7/result/approve', method: 'POST', body: { resultNumber: '482175' } });
    expect(call(2)).toEqual({ url: '/v1/admin/draws/7/result/reject', method: 'POST', body: {} });
  });

  it('reviews: approve sends an empty object, reject sends a note', async () => {
    const { api, call } = setup(() => new Response('{}', { status: 200 }));
    await api.admin.kyc.approve(5);
    await api.admin.kyc.reject(5, 'ຮູບບໍ່ຊັດ');
    await api.admin.withdrawals.approve(4);
    await api.admin.withdrawals.reject(4, 'ຊື່ບໍ່ກົງ');
    await api.admin.payouts.approve(2);
    await api.admin.payouts.reject(2, 'ກວດຄືນ');
    expect([0, 1, 2, 3, 4, 5].map(call)).toEqual([
      { url: '/v1/admin/kyc/5/approve', method: 'POST', body: {} },
      { url: '/v1/admin/kyc/5/reject', method: 'POST', body: { note: 'ຮູບບໍ່ຊັດ' } },
      { url: '/v1/admin/withdrawals/4/approve', method: 'POST', body: {} },
      { url: '/v1/admin/withdrawals/4/reject', method: 'POST', body: { note: 'ຊື່ບໍ່ກົງ' } },
      { url: '/v1/admin/payouts/2/approve', method: 'POST', body: {} },
      { url: '/v1/admin/payouts/2/reject', method: 'POST', body: { note: 'ກວດຄືນ' } },
    ]);
  });

  it('users, settings, reports, me', async () => {
    const { api, call } = setup(() => new Response('{}', { status: 200 }));
    await api.admin.users.update(9, { role: 'agent', commissionBp: 250 });
    expect(call(0)).toEqual({ url: '/v1/admin/users/9', method: 'PATCH', body: { role: 'agent', commissionBp: 250 } });
    await api.admin.settings.update('payout_auto_limit', 5000000);
    expect(call(1)).toEqual({ url: '/v1/admin/settings/payout_auto_limit', method: 'PUT', body: { value: 5000000 } });
    await api.admin.reports.draw(7);
    expect(call(2).url).toBe('/v1/admin/reports/draws/7');
    await api.me.setPin('482910');
    expect(call(3)).toEqual({ url: '/v1/me/pin', method: 'POST', body: { pin: '482910' } });
    await api.me.setPin('482910', '111222');
    expect(call(4).body).toEqual({ pin: '482910', currentPin: '111222' });
  });

  it('auth: OTP and logout (logout revokes the refresh token and always clears local tokens)', async () => {
    const { api, call, tokens, fetchMock } = setup(() => new Response(null, { status: 204 }));
    await api.auth.requestOtp('02055551234');
    expect(call(0)).toEqual({ url: '/v1/auth/otp/request', method: 'POST', body: { phone: '02055551234' } });
    await api.auth.verifyOtp('02055551234', '123456');
    expect(call(1).body).toEqual({ phone: '02055551234', code: '123456' });
    await api.auth.logout();
    expect(call(2)).toEqual({ url: '/v1/auth/logout', method: 'POST', body: { refreshToken: 'ref-xxxxxxxxxxxxxxxxxxxxxx' } });
    expect(tokens.getRefreshToken()).toBeNull();
    expect(tokens.getAccessToken()).toBeNull();

    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('offline')));
    tokens.setTokens('a', 'r-xxxxxxxxxxxxxxxxxxxxxxx');
    await expect(api.auth.logout()).rejects.toMatchObject({ code: 'NETWORK' });
    expect(tokens.getRefreshToken()).toBeNull();
  });
});
