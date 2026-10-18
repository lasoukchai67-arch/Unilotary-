import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { PIN, assertLedgerConsistent, balanceOf, makeUser, setup, type TestEnv, type TestUser } from './helpers.js';
import { sign } from '../src/providers/payments.js';

let env: TestEnv;
let finance: TestUser;

before(async () => {
  env = await setup();
  finance = await makeUser(env, { role: 'finance' });
});
after(async () => {
  await assertLedgerConsistent(env);
  await env.close();
});

const webhook = (body: object, secret = env.ctx.config.PAYMENT_WEBHOOK_SECRET) => {
  const raw = JSON.stringify(body);
  return env.app.inject({
    method: 'POST',
    url: '/v1/webhooks/payments/mock',
    headers: { 'content-type': 'application/json', 'x-signature': sign(secret, raw) },
    payload: raw,
  });
};

async function deposit(u: TestUser, amount: number) {
  const r = await env.app.inject({ method: 'POST', url: '/v1/wallet/deposits', headers: u.headers, payload: { amount } });
  assert.equal(r.statusCode, 201, r.body);
  const d = r.json();
  const { rows } = await env.ctx.db.query('SELECT provider_ref FROM payments WHERE id = $1', [d.id]);
  return { ...d, providerRef: rows[0].provider_ref as string };
}

async function withdraw(u: TestUser, amount: number, pin = PIN) {
  return env.app.inject({
    method: 'POST',
    url: '/v1/wallet/withdrawals',
    headers: u.headers,
    payload: { amount, bankName: 'BCEL', accountNo: '010-12-00-1234567', accountName: 'Somchai', pin },
  });
}

describe('deposits', () => {
  test('ສ້າງ QR → webhook ສຳເລັດ → ເຕີມເງິນເທື່ອດຽວ (webhook ຊ້ຳບໍ່ເຕີມຊ້ຳ)', async () => {
    const u = await makeUser(env);
    const d = await deposit(u, 100_000);
    assert.equal(d.status, 'pending');
    assert.match(d.qrPayload, /^MOCKPAY\|/);

    const ev = { providerRef: d.providerRef, status: 'success', amount: 100_000 };
    assert.equal((await webhook(ev)).statusCode, 200);
    assert.equal((await webhook(ev)).statusCode, 200);
    assert.equal((await balanceOf(env, u.id)).balance, 100_000);

    const get = await env.app.inject({ method: 'GET', url: `/v1/wallet/deposits/${d.id}`, headers: u.headers });
    assert.equal(get.json().status, 'success');
    const n = await env.app.inject({ method: 'GET', url: '/v1/notifications', headers: u.headers });
    assert.equal(n.json().unread, 1);
    assert.equal(n.json().items[0].title, 'ເຕີມເງິນສຳເລັດ');
  });

  test('ລາຍເຊັນຜິດ → 401, ບໍ່ເຕີມເງິນ', async () => {
    const u = await makeUser(env);
    const d = await deposit(u, 50_000);
    const r = await webhook({ providerRef: d.providerRef, status: 'success', amount: 50_000 }, 'wrong-secret-wrong');
    assert.equal(r.statusCode, 401);
    assert.equal((await balanceOf(env, u.id)).balance, 0);
  });

  test('ຍອດເງິນບໍ່ກົງ → failed ແລະ ບັນທຶກ audit', async () => {
    const u = await makeUser(env);
    const d = await deposit(u, 50_000);
    await webhook({ providerRef: d.providerRef, status: 'success', amount: 5_000 });
    assert.equal((await balanceOf(env, u.id)).balance, 0);
    const { rows } = await env.ctx.db.query(`SELECT 1 FROM audit_logs WHERE action = 'deposit.amount_mismatch' AND entity_id = $1`, [String(d.id)]);
    assert.equal(rows.length, 1);
  });

  test('ປຸ່ມຈຳລອງການຈ່າຍ (ໂໝດທົດລອງ)', async () => {
    const u = await makeUser(env);
    const d = await deposit(u, 20_000);
    const r = await env.app.inject({ method: 'POST', url: `/v1/dev/deposits/${d.id}/simulate`, headers: u.headers, payload: { status: 'success' } });
    assert.equal(r.json().status, 'success');
    assert.equal((await balanceOf(env, u.id)).balance, 20_000);
  });

  test('ຈຳນວນເງິນນອກຂອບເຂດ', async () => {
    const u = await makeUser(env);
    const r = await env.app.inject({ method: 'POST', url: '/v1/wallet/deposits', headers: u.headers, payload: { amount: 500 } });
    assert.equal(r.json().error, 'VALIDATION');
  });
});

describe('withdrawals', () => {
  test('ຖອນ: ຕ້ອງໃສ່ PIN, ເງິນຍ້າຍໄປ held, ອະນຸມັດ → paid', async () => {
    const u = await makeUser(env);
    const d = await deposit(u, 300_000);
    await webhook({ providerRef: d.providerRef, status: 'success', amount: 300_000 });

    assert.equal((await withdraw(u, 100_000, '000000')).json().error, 'PIN_INVALID');
    const w = await withdraw(u, 100_000);
    assert.equal(w.statusCode, 201, w.body);
    assert.equal(w.json().status, 'requested');
    assert.deepEqual(await balanceOf(env, u.id), { balance: 200_000, held: 100_000 });

    // ລູກຄ້າອະນຸມັດເອງບໍ່ໄດ້
    assert.equal((await env.app.inject({ method: 'POST', url: `/v1/admin/withdrawals/${w.json().id}/approve`, headers: u.headers })).statusCode, 403);

    const list = await env.app.inject({ method: 'GET', url: '/v1/admin/withdrawals?status=requested', headers: finance.headers });
    assert.ok(list.json().items.some((x: any) => x.id === w.json().id && x.userPhone === u.phone));

    const ok = await env.app.inject({ method: 'POST', url: `/v1/admin/withdrawals/${w.json().id}/approve`, headers: finance.headers });
    assert.equal(ok.json().status, 'paid');
    assert.deepEqual(await balanceOf(env, u.id), { balance: 200_000, held: 0 });
    // ອະນຸມັດຊ້ຳບໍ່ໄດ້
    assert.equal((await env.app.inject({ method: 'POST', url: `/v1/admin/withdrawals/${w.json().id}/approve`, headers: finance.headers })).statusCode, 409);
  });

  test('ປະຕິເສດ → ຄືນເງິນ; ໂອນລົ້ມເຫຼວ → failed ແລະ ຄືນເງິນ', async () => {
    const u = await makeUser(env);
    const d = await deposit(u, 200_000);
    await webhook({ providerRef: d.providerRef, status: 'success', amount: 200_000 });

    const w1 = (await withdraw(u, 60_000)).json();
    const rej = await env.app.inject({ method: 'POST', url: `/v1/admin/withdrawals/${w1.id}/reject`, headers: finance.headers, payload: { note: 'ຊື່ບັນຊີບໍ່ກົງ' } });
    assert.equal(rej.json().status, 'rejected');
    assert.deepEqual(await balanceOf(env, u.id), { balance: 200_000, held: 0 });

    const w2 = (await withdraw(u, 70_000)).json();
    env.payments.failNextPayout = true;
    const fail = await env.app.inject({ method: 'POST', url: `/v1/admin/withdrawals/${w2.id}/approve`, headers: finance.headers });
    assert.equal(fail.json().status, 'failed');
    assert.deepEqual(await balanceOf(env, u.id), { balance: 200_000, held: 0 });
  });

  test('ຕ້ອງ KYC ກ່ອນ ແລະ ເງິນບໍ່ພໍ', async () => {
    const noKyc = await makeUser(env, { kyc: 'unsubmitted' });
    assert.equal((await withdraw(noKyc, 50_000)).json().error, 'USER_NOT_ALLOWED');
    const poor = await makeUser(env);
    assert.equal((await withdraw(poor, 50_000)).json().error, 'INSUFFICIENT_BALANCE');
  });

  test('ປະຫວັດລາຍການເງິນ ແລະ ລາຍການຖອນ ແບ່ງໜ້າໄດ້', async () => {
    const u = await makeUser(env);
    for (const amt of [10_000, 20_000, 30_000]) {
      const d = await deposit(u, amt);
      await webhook({ providerRef: d.providerRef, status: 'success', amount: amt });
    }
    const p1 = (await env.app.inject({ method: 'GET', url: '/v1/wallet/transactions?limit=2', headers: u.headers })).json();
    assert.equal(p1.items.length, 2);
    assert.equal(p1.items[0].amount, 30_000);
    const p2 = (await env.app.inject({ method: 'GET', url: `/v1/wallet/transactions?limit=2&before=${p1.nextBefore}`, headers: u.headers })).json();
    assert.equal(p2.items.length, 1);
    assert.equal(p2.nextBefore, null);
    assert.deepEqual((await env.app.inject({ method: 'GET', url: '/v1/wallet', headers: u.headers })).json(), { balance: 60_000, held: 0 });
  });
});
