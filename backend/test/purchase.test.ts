import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { PIN, assertLedgerConsistent, balanceOf, buy, key, makeUser, openDraw, setup, type TestEnv, type TestUser } from './helpers.js';
import { soldAmount } from '../src/modules/limits.js';

let env: TestEnv;
let admin: TestUser;
let drawId: number;

before(async () => {
  env = await setup();
  admin = await makeUser(env, { role: 'admin' });
});
after(async () => {
  await assertLedgerConsistent(env);
  await env.close();
});

describe('purchase', () => {
  test('ຊື້ສຳເລັດ: ຕັດເງິນ, ອອກບິນ, ledger ແລະ ຍອດຂາຍ', async () => {
    drawId = await openDraw(env, admin);
    const u = await makeUser(env, { balance: 100_000 });
    const res = await buy(env, u, drawId, [
      { number: '27', amount: 10_000 },
      { number: '583', amount: 5_000 },
    ]);
    assert.equal(res.statusCode, 201, res.body);
    const t = res.json();
    assert.match(t.ticketNo, /^LT-.+-\d{6}$/);
    assert.equal(t.totalAmount, 15_000);
    assert.equal(t.balanceAfter, 85_000);
    assert.equal(t.status, 'active');
    assert.deepEqual(t.lines.map((l: any) => [l.number, l.digits, l.payoutRate]), [['27', 2, 60], ['583', 3, 400]]);
    assert.equal((await balanceOf(env, u.id)).balance, 85_000);
    assert.equal(await soldAmount(env.ctx.redis, drawId, '27'), 10_000);

    const list = await env.app.inject({ method: 'GET', url: '/v1/tickets', headers: u.headers });
    assert.equal(list.json().items[0].id, t.id);
    const one = await env.app.inject({ method: 'GET', url: `/v1/tickets/${t.id}`, headers: u.headers });
    assert.equal(one.json().ticketNo, t.ticketNo);

    // ກວດບິນແທ້ (ບໍ່ຕ້ອງ login)
    const v = await env.app.inject({ method: 'GET', url: `/v1/tickets/verify/${t.ticketNo}?code=${t.verifyCode.toLowerCase()}` });
    assert.equal(v.statusCode, 200);
    assert.equal(v.json().totalAmount, 15_000);
    assert.equal((await env.app.inject({ method: 'GET', url: `/v1/tickets/verify/${t.ticketNo}?code=WRONG` })).statusCode, 404);

    // ຄົນອື່ນເບິ່ງບິນນີ້ບໍ່ໄດ້
    const other = await makeUser(env);
    assert.equal((await env.app.inject({ method: 'GET', url: `/v1/tickets/${t.id}`, headers: other.headers })).statusCode, 404);
  });

  test('ກົດຊື້ຊ້ຳດ້ວຍ key ເດີມ (ພ້ອມກັນ 3 ເທື່ອ): ໄດ້ບິນດຽວ, ຕັດເງິນເທື່ອດຽວ', async () => {
    const u = await makeUser(env, { balance: 100_000 });
    const k = key();
    const results = await Promise.all([1, 2, 3].map(() => buy(env, u, drawId, [{ number: '11', amount: 20_000 }], k)));
    assert.equal(new Set(results.map((r) => r.json().id)).size, 1);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 200, 201]);
    assert.equal((await balanceOf(env, u.id)).balance, 80_000);
    assert.equal(await soldAmount(env.ctx.redis, drawId, '11'), 20_000);
  });

  test('50 ຄົນຊື້ພ້ອມກັນ: ບໍ່ຂາຍເກີນວົງເງິນເດັດຂາດ', async () => {
    const users = await Promise.all(Array.from({ length: 50 }, () => makeUser(env, { balance: 50_000 })));
    const results = await Promise.all(users.map((u) => buy(env, u, drawId, [{ number: '99', amount: 5_000 }])));
    assert.equal(results.filter((r) => r.statusCode === 201).length, 20); // 100,000 / 5,000
    for (const r of results.filter((x) => x.statusCode !== 201)) assert.equal(r.json().error, 'NUMBER_LIMIT');
    const { rows } = await env.ctx.db.query('SELECT sold_amount FROM number_sales WHERE draw_id = $1 AND number = $2', [drawId, '99']);
    assert.equal(rows[0].sold_amount, 100_000);
  });

  test('ບິນມີເລກໜຶ່ງເຕັມ: ປະຕິເສດທັງບິນ ແລະ ບອກຍອດທີ່ເຫຼືອ', async () => {
    const u = await makeUser(env, { balance: 500_000 });
    assert.equal((await buy(env, u, drawId, [{ number: '45', amount: 95_000 }])).statusCode, 201);
    const res = await buy(env, u, drawId, [
      { number: '12', amount: 10_000 },
      { number: '45', amount: 10_000 },
    ]);
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.json().details, [{ number: '45', reason: 'full', remaining: 5000 }]);
    assert.equal(await soldAmount(env.ctx.redis, drawId, '12'), 0);
  });

  test('ເງິນບໍ່ພໍ: ຄືນວົງເງິນທີ່ຈອງໄວ້', async () => {
    const u = await makeUser(env, { balance: 5_000 });
    const res = await buy(env, u, drawId, [{ number: '33', amount: 10_000 }]);
    assert.equal(res.json().error, 'INSUFFICIENT_BALANCE');
    assert.equal(await soldAmount(env.ctx.redis, drawId, '33'), 0);
  });

  test('KYC ຍັງບໍ່ຜ່ານ / ພັກການຫຼິ້ນ / ວົງເງິນຕໍ່ມື້', async () => {
    const pending = await makeUser(env, { kyc: 'pending', balance: 50_000 });
    const r1 = await buy(env, pending, drawId, [{ number: '27', amount: 1_000 }]);
    assert.equal(r1.json().error, 'USER_NOT_ALLOWED');
    assert.equal(r1.json().details.reason, 'kyc');

    const ex = await makeUser(env, { balance: 50_000 });
    await env.app.inject({ method: 'POST', url: '/v1/me/self-exclusion', headers: ex.headers, payload: { days: 7, pin: PIN } });
    const r2 = await buy(env, ex, drawId, [{ number: '27', amount: 1_000 }]);
    assert.equal(r2.json().details.reason, 'self_excluded');

    const capped = await makeUser(env, { balance: 50_000 });
    await env.app.inject({ method: 'PATCH', url: '/v1/me/settings', headers: capped.headers, payload: { dailySpendCap: 15_000, pin: PIN } });
    assert.equal((await buy(env, capped, drawId, [{ number: '27', amount: 10_000 }])).statusCode, 201);
    const r3 = await buy(env, capped, drawId, [{ number: '28', amount: 10_000 }]);
    assert.equal(r3.json().error, 'DAILY_CAP');
    assert.equal(await soldAmount(env.ctx.redis, drawId, '28'), 0);
  });

  test('ຂໍ້ມູນຜິດ: ເລກ 1 ໂຕ, ປະເພດທີ່ບໍ່ຂາຍ, ເກີນຕໍ່ແຖວ, key ຜິດ', async () => {
    const u = await makeUser(env, { balance: 500_000 });
    assert.equal((await buy(env, u, drawId, [{ number: '7', amount: 1_000 }])).statusCode, 400);
    assert.equal((await buy(env, u, drawId, [{ number: '1234', amount: 1_000 }])).json().error, 'VALIDATION');
    assert.equal((await buy(env, u, drawId, [{ number: '56', amount: 200_000 }])).json().error, 'VALIDATION');
    assert.equal((await buy(env, u, drawId, [{ number: '56', amount: 1_000 }], 'bad')).statusCode, 400);
  });

  test('Redis ເສຍຂໍ້ມູນ: ໂຫຼດຄືນຈາກ DB, ຍັງບໍ່ຂາຍເກີນ', async () => {
    const u = await makeUser(env, { balance: 500_000 });
    assert.equal((await buy(env, u, drawId, [{ number: '50', amount: 90_000 }])).statusCode, 201);
    await env.ctx.redis.flushdb();
    assert.equal((await buy(env, u, drawId, [{ number: '50', amount: 20_000 }])).json().error, 'NUMBER_LIMIT');
    assert.equal((await buy(env, u, drawId, [{ number: '50', amount: 10_000 }])).statusCode, 201);
  });

  test('ແອັດມິນປິດເລກ ແລະ ຕັ້ງເລກອັ້ນ: ມີຜົນທັນທີ', async () => {
    const u = await makeUser(env, { balance: 500_000 });
    const put = (n: string, body: object) => env.app.inject({ method: 'PUT', url: `/v1/admin/draws/${drawId}/numbers/${n}/limit`, headers: admin.headers, payload: body });
    assert.equal((await put('69', { cap: null, payoutRate: null, closed: true })).statusCode, 204);
    assert.equal((await buy(env, u, drawId, [{ number: '69', amount: 1_000 }])).json().details[0].reason, 'closed');
    assert.equal((await put('88', { cap: 3_000, payoutRate: 30, closed: false })).statusCode, 204);
    const t = await buy(env, u, drawId, [{ number: '88', amount: 3_000 }]);
    assert.equal(t.json().lines[0].payoutRate, 30);
    assert.equal((await buy(env, u, drawId, [{ number: '88', amount: 1_000 }])).json().error, 'NUMBER_LIMIT');

    const exp = await env.app.inject({ method: 'GET', url: `/v1/admin/draws/${drawId}/exposure?digits=2`, headers: admin.headers });
    const rows = exp.json().items as any[];
    assert.ok(rows.find((x) => x.number === '69' && x.closed));
    const e99 = rows.find((x) => x.number === '99');
    assert.equal(e99.exposure, 100_000 * 60);
  });

  test('ຕົວແທນຂາຍແທນລູກຄ້າ: ຕັດເງິນຕົວແທນ ແລະ ບັນທຶກຄ່າຄອມ', async () => {
    const agent = await makeUser(env, { role: 'agent', balance: 200_000, commissionBp: 1500 });
    const res = await env.app.inject({
      method: 'POST',
      url: '/v1/agent/sales',
      headers: { ...agent.headers, 'idempotency-key': key() },
      payload: { drawId, buyerPhone: '020 5555 0000', lines: [{ number: '31', amount: 20_000 }] },
    });
    assert.equal(res.statusCode, 201, res.body);
    assert.equal(res.json().buyerPhone, '02055550000');
    const s = await env.app.inject({ method: 'GET', url: '/v1/agent/summary', headers: agent.headers });
    assert.deepEqual(s.json(), { sales: 20_000, tickets: 1, commissionPending: 3_000, commissionSettled: 0 });

    const customer = await makeUser(env);
    assert.equal((await env.app.inject({ method: 'GET', url: '/v1/agent/summary', headers: customer.headers })).statusCode, 403);
  });

  test('ງວດປິດແລ້ວ → DRAW_NOT_OPEN', async () => {
    const u = await makeUser(env, { balance: 50_000 });
    await env.app.inject({ method: 'POST', url: `/v1/admin/draws/${drawId}/close`, headers: admin.headers });
    assert.equal((await buy(env, u, drawId, [{ number: '27', amount: 1_000 }])).json().error, 'DRAW_NOT_OPEN');
  });
});
