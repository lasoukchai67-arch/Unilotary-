import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { PIN, makeUser, newPhone, setup, type TestEnv } from './helpers.js';
import { normalizePhone } from '../src/modules/auth.js';

let env: TestEnv;
before(async () => {
  env = await setup();
});
after(async () => env.close());

const post = (url: string, payload: unknown, headers: Record<string, string> = {}) =>
  env.app.inject({ method: 'POST', url, payload: payload as object, headers });

describe('auth', () => {
  test('ແປງເບີໂທ +856 / 856 / ມີຍະຫວ່າງ', () => {
    assert.equal(normalizePhone('+856 20 5555 1234'), '02055551234');
    assert.equal(normalizePhone('8562055551234'), '02055551234');
    assert.equal(normalizePhone('030-555-1234'), '0305551234');
    assert.throws(() => normalizePhone('0812345678'));
  });

  test('OTP → ລົງທະບຽນອັດຕະໂນມັດ, ໄດ້ token ແລະ ກະເປົາ', async () => {
    const phone = newPhone();
    const r1 = await post('/v1/auth/otp/request', { phone });
    assert.equal(r1.statusCode, 200);
    const { devCode, expiresInSec } = r1.json();
    assert.match(devCode, /^\d{6}$/);
    assert.equal(expiresInSec, 300);
    assert.ok(env.sms.sent.at(-1)!.text.includes(devCode));

    const bad = await post('/v1/auth/otp/verify', { phone, code: devCode === '000000' ? '111111' : '000000' });
    assert.equal(bad.statusCode, 401);

    const r2 = await post('/v1/auth/otp/verify', { phone, code: devCode });
    assert.equal(r2.statusCode, 200);
    const body = r2.json();
    assert.equal(body.user.phone, phone);
    assert.equal(body.user.kyc, 'unsubmitted');
    assert.equal(body.user.pinSet, false);
    assert.equal(body.user.balance, 0);

    const me = await env.app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${body.accessToken}` } });
    assert.equal(me.json().id, body.user.id);

    // OTP ໃຊ້ໄດ້ເທື່ອດຽວ
    assert.equal((await post('/v1/auth/otp/verify', { phone, code: devCode })).statusCode, 401);
  });

  test('ຂໍ OTP ຊ້ຳພາຍໃນ 1 ນາທີ ຖືກປະຕິເສດ', async () => {
    const phone = newPhone();
    assert.equal((await post('/v1/auth/otp/request', { phone })).statusCode, 200);
    const again = await post('/v1/auth/otp/request', { phone });
    assert.equal(again.statusCode, 429);
    assert.equal(again.json().error, 'RATE_LIMITED');
  });

  test('ໃສ່ OTP ຜິດ 5 ເທື່ອ → OTP ໃຊ້ບໍ່ໄດ້ອີກ', async () => {
    const phone = newPhone();
    const code = (await post('/v1/auth/otp/request', { phone })).json().devCode;
    const wrong = code === '999999' ? '888888' : '999999';
    for (let i = 0; i < 5; i++) await post('/v1/auth/otp/verify', { phone, code: wrong });
    assert.equal((await post('/v1/auth/otp/verify', { phone, code })).statusCode, 401);
  });

  test('refresh token ໝູນວຽນ; ໃຊ້ token ເກົ່າຊ້ຳ → ຍົກເລີກທຸກ session', async () => {
    const phone = newPhone();
    const code = (await post('/v1/auth/otp/request', { phone })).json().devCode;
    const first = (await post('/v1/auth/otp/verify', { phone, code })).json();

    const r1 = await post('/v1/auth/refresh', { refreshToken: first.refreshToken });
    assert.equal(r1.statusCode, 200);
    const second = r1.json();
    assert.notEqual(second.refreshToken, first.refreshToken);

    // token ເກົ່າຖືກນຳມາໃຊ້ອີກ = ອາດຖືກລັກ
    assert.equal((await post('/v1/auth/refresh', { refreshToken: first.refreshToken })).statusCode, 401);
    // token ໃໝ່ກໍຖືກຍົກເລີກນຳ
    assert.equal((await post('/v1/auth/refresh', { refreshToken: second.refreshToken })).statusCode, 401);
  });

  test('logout ຍົກເລີກ refresh token', async () => {
    const phone = newPhone();
    const code = (await post('/v1/auth/otp/request', { phone })).json().devCode;
    const t = (await post('/v1/auth/otp/verify', { phone, code })).json();
    assert.equal((await post('/v1/auth/logout', { refreshToken: t.refreshToken })).statusCode, 204);
    assert.equal((await post('/v1/auth/refresh', { refreshToken: t.refreshToken })).statusCode, 401);
  });

  test('ບັນຊີຖືກລະງັບ → token ໃຊ້ບໍ່ໄດ້ທັນທີ', async () => {
    const u = await makeUser(env);
    await env.ctx.db.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [u.id]);
    const me = await env.app.inject({ method: 'GET', url: '/v1/me', headers: u.headers });
    assert.equal(me.statusCode, 403);
  });

  test('ບໍ່ມີ token / token ປອມ → 401', async () => {
    assert.equal((await env.app.inject({ method: 'GET', url: '/v1/me' })).statusCode, 401);
    assert.equal((await env.app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: 'Bearer abc.def.ghi' } })).statusCode, 401);
  });

  test('PIN: ຕັ້ງ, ປ່ຽນຕ້ອງໃສ່ PIN ເກົ່າ, ຜິດ 5 ເທື່ອ → ລັອກ', async () => {
    const u = await makeUser(env, { pin: false });
    assert.equal((await post('/v1/me/pin', { pin: '111111' }, u.headers)).statusCode, 204);
    assert.equal((await post('/v1/me/pin', { pin: '222222' }, u.headers)).statusCode, 401); // ບໍ່ມີ currentPin
    assert.equal((await post('/v1/me/pin', { pin: '222222', currentPin: '111111' }, u.headers)).statusCode, 204);

    const codes: string[] = [];
    for (let i = 0; i < 5; i++) codes.push((await post('/v1/me/self-exclusion', { days: 1, pin: '999999' }, u.headers)).json().error);
    assert.deepEqual(codes, ['PIN_INVALID', 'PIN_INVALID', 'PIN_INVALID', 'PIN_INVALID', 'PIN_LOCKED']);
    const locked = await post('/v1/me/self-exclusion', { days: 1, pin: '222222' }, u.headers);
    assert.equal(locked.json().error, 'PIN_LOCKED');
  });

  test('ຕັ້ງວົງເງິນຕໍ່ມື້ ແລະ ພັກການຫຼິ້ນ (ຫຍໍ້ລົງບໍ່ໄດ້)', async () => {
    const u = await makeUser(env);
    const s = await env.app.inject({ method: 'PATCH', url: '/v1/me/settings', headers: u.headers, payload: { dailySpendCap: 50000, pin: PIN } });
    assert.equal(s.json().dailySpendCap, 50000);
    const a = (await post('/v1/me/self-exclusion', { days: 30, pin: PIN }, u.headers)).json();
    const b = (await post('/v1/me/self-exclusion', { days: 1, pin: PIN }, u.headers)).json();
    assert.equal(new Date(b.selfExcludedUntil).getTime(), new Date(a.selfExcludedUntil).getTime());
  });
});
