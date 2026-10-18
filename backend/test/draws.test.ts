import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RULES, assertLedgerConsistent, balanceOf, buy, key, makeUser, openDraw, setup, type TestEnv, type TestUser } from './helpers.js';
import { tick } from '../src/jobs/scheduler.js';

let env: TestEnv;
let maker: TestUser;
let checker: TestUser;

before(async () => {
  env = await setup();
  maker = await makeUser(env, { role: 'admin' });
  checker = await makeUser(env, { role: 'admin' });
});
after(async () => {
  await assertLedgerConsistent(env);
  await env.close();
});

const post = (u: TestUser, url: string, payload?: object) => env.app.inject({ method: 'POST', url, headers: u.headers, payload });

describe('draw lifecycle', () => {
  test('scheduler ເປີດ ແລະ ປິດງວດຕາມເວລາ', async () => {
    const now = Date.now();
    const r = await post(maker, '/v1/admin/draws', {
      drawNo: `S${now % 100000}`,
      drawDate: new Date(now).toISOString().slice(0, 10),
      salesOpenAt: new Date(now - 1000).toISOString(),
      salesCloseAt: new Date(now + 60_000).toISOString(),
      rules: DEFAULT_RULES,
    });
    assert.equal(r.statusCode, 201, r.body);
    const id = r.json().id;
    assert.equal(r.json().status, 'scheduled');
    assert.ok((await tick(env.ctx)).opened.includes(id));
    const cur = await env.app.inject({ method: 'GET', url: '/v1/draws/current' });
    assert.equal(cur.json().id, id);
    assert.equal(cur.json().rules[0].defaultNumberCap, undefined); // ບໍ່ເປີດເຜີຍ cap ໃຫ້ສາທາລະນະ

    await env.ctx.db.query(`UPDATE draws SET sales_close_at = now() - interval '1 second' WHERE id = $1`, [id]);
    assert.ok((await tick(env.ctx)).closed.includes(id));
    const d = await env.app.inject({ method: 'GET', url: `/v1/draws/${id}` });
    assert.equal(d.json().status, 'closed');
  });

  test('ສ້າງງວດ: ເລກງວດຊ້ຳ ແລະ ເວລາຜິດ ຖືກປະຕິເສດ', async () => {
    const now = Date.now();
    const body = {
      drawNo: 'DUP1',
      drawDate: '2026-10-20',
      salesOpenAt: new Date(now).toISOString(),
      salesCloseAt: new Date(now + 3600_000).toISOString(),
      rules: DEFAULT_RULES,
    };
    assert.equal((await post(maker, '/v1/admin/draws', body)).statusCode, 201);
    assert.equal((await post(maker, '/v1/admin/draws', body)).json().error, 'CONFLICT');
    const bad = await post(maker, '/v1/admin/draws', { ...body, drawNo: 'BAD1', salesCloseAt: new Date(now - 1000).toISOString() });
    assert.equal(bad.statusCode, 400);
  });

  test('ຕັດສິນຜົນ: maker–checker, ຄິດລາງວັນຖືກຕ້ອງ, ຈ່າຍອັດຕະໂນມັດ / ລໍຖ້າອະນຸມັດ, ຄ່າຄອມ', async () => {
    const drawId = await openDraw(env, maker);
    const a = await makeUser(env, { balance: 100_000 });
    const b = await makeUser(env, { balance: 100_000 });
    const agent = await makeUser(env, { role: 'agent', balance: 100_000, commissionBp: 1000 });

    // ຜົນ = 482175 → 2 ໂຕ "75", 3 ໂຕ "175", 6 ໂຕ "482175"
    const ta = (await buy(env, a, drawId, [
      { number: '75', amount: 10_000 }, // ຖືກ 2 ໂຕ: 600,000
      { number: '175', amount: 2_000 }, // ຖືກ 3 ໂຕ: 800,000
      { number: '21', amount: 5_000 }, // ບໍ່ຖືກ
    ])).json();
    const tb = (await buy(env, b, drawId, [{ number: '482175', amount: 1_000 }])).json(); // 6 ໂຕ: 100,000,000 (ຍອດໃຫຍ່)
    const tLost = (await buy(env, b, drawId, [{ number: '57', amount: 1_000 }])).json();
    const tAgent = (
      await env.app.inject({
        method: 'POST',
        url: '/v1/agent/sales',
        headers: { ...agent.headers, 'idempotency-key': key() },
        payload: { drawId, lines: [{ number: '40', amount: 50_000 }] },
      })
    ).json();

    // ຍັງບໍ່ປິດງວດ → ປ້ອນຜົນບໍ່ໄດ້
    assert.equal((await post(maker, `/v1/admin/draws/${drawId}/result`, { resultNumber: '482175' })).statusCode, 409);
    await post(maker, `/v1/admin/draws/${drawId}/close`);

    const entered = await post(maker, `/v1/admin/draws/${drawId}/result`, { resultNumber: '482175' });
    assert.equal(entered.json().pendingResult, '482175');
    // ຜູ້ຢືນຢັນເບິ່ງເລກທີ່ປ້ອນບໍ່ໄດ້ (ຕ້ອງພິມເອງ)
    const seen = (await env.app.inject({ method: 'GET', url: `/v1/admin/draws/${drawId}`, headers: checker.headers })).json();
    assert.equal(seen.pendingResult, null);
    assert.equal(seen.hasPendingResult, true);
    // ຄົນດຽວກັນຢືນຢັນເອງບໍ່ໄດ້
    assert.equal((await post(maker, `/v1/admin/draws/${drawId}/result/approve`, { resultNumber: '482175' })).statusCode, 403);
    // ເລກບໍ່ກົງ
    assert.equal((await post(checker, `/v1/admin/draws/${drawId}/result/approve`, { resultNumber: '482176' })).json().error, 'CONFLICT');
    // ລູກຄ້າເຂົ້າບໍ່ໄດ້
    assert.equal((await post(a, `/v1/admin/draws/${drawId}/result/approve`, { resultNumber: '482175' })).statusCode, 403);

    const ok = await post(checker, `/v1/admin/draws/${drawId}/result/approve`, { resultNumber: '482175' });
    assert.equal(ok.statusCode, 200, ok.body);
    assert.deepEqual(ok.json().settlement, { winners: 2, totalWin: 1_400_000 + 100_000_000, autoPaid: 1, pendingPayouts: 1 });
    assert.equal(ok.json().draw.status, 'resulted');
    assert.equal(ok.json().draw.resultNumber, '482175');

    // a: ຖືກ 1,400,000 ຈ່າຍອັດຕະໂນມັດ
    const ticketA = (await env.app.inject({ method: 'GET', url: `/v1/tickets/${ta.id}`, headers: a.headers })).json();
    assert.equal(ticketA.status, 'paid');
    assert.equal(ticketA.totalWin, 1_400_000);
    assert.deepEqual(ticketA.lines.map((l: any) => l.winAmount), [600_000, 800_000, 0]);
    assert.equal((await balanceOf(env, a.id)).balance, 100_000 - 17_000 + 1_400_000);

    // b: ຍອດໃຫຍ່ ລໍຖ້າອະນຸມັດ
    assert.equal((await env.app.inject({ method: 'GET', url: `/v1/tickets/${tb.id}`, headers: b.headers })).json().status, 'won');
    assert.equal((await env.app.inject({ method: 'GET', url: `/v1/tickets/${tLost.id}`, headers: b.headers })).json().status, 'lost');
    const pending = (await env.app.inject({ method: 'GET', url: '/v1/admin/payouts?status=pending', headers: maker.headers })).json().items;
    const p = pending.find((x: any) => x.ticketId === tb.id);
    assert.equal(p.amount, 100_000_000);
    const paid = await post(checker, `/v1/admin/payouts/${p.id}/approve`);
    assert.equal(paid.json().status, 'paid');
    assert.equal((await balanceOf(env, b.id)).balance, 100_000 - 2_000 + 100_000_000);
    assert.equal((await post(checker, `/v1/admin/payouts/${p.id}/approve`)).statusCode, 409);

    // ຕົວແທນ: ຄ່າຄອມ 10% ຂອງ 50,000 ເຂົ້າກະເປົາຫຼັງຕັດສິນ
    assert.equal(tAgent.status, 'active');
    assert.equal((await balanceOf(env, agent.id)).balance, 100_000 - 50_000 + 5_000);
    const s = (await env.app.inject({ method: 'GET', url: '/v1/agent/summary', headers: agent.headers })).json();
    assert.deepEqual([s.commissionPending, s.commissionSettled], [0, 5_000]);

    // ລາຍງານງວດ
    const rep = (await env.app.inject({ method: 'GET', url: `/v1/admin/reports/draws/${drawId}`, headers: maker.headers })).json();
    assert.equal(rep.sales.total, 17_000 + 1_000 + 1_000 + 50_000);
    assert.equal(rep.payouts.total, 101_400_000);
    assert.equal(rep.payouts.pending, 0);
    assert.equal(rep.commissions, 5_000);
    assert.equal(rep.net, 69_000 - 101_400_000 - 5_000);

    // ຜົນສາທາລະນະ
    const pub = (await env.app.inject({ method: 'GET', url: '/v1/draws?status=resulted' })).json().items;
    assert.ok(pub.some((d: any) => d.id === drawId && d.resultNumber === '482175'));
  });

  test('ປະຕິເສດຜົນທີ່ປ້ອນ ແລ້ວປ້ອນໃໝ່ໄດ້', async () => {
    const drawId = await openDraw(env, maker);
    await post(maker, `/v1/admin/draws/${drawId}/close`);
    await post(maker, `/v1/admin/draws/${drawId}/result`, { resultNumber: '111111' });
    const rej = await post(checker, `/v1/admin/draws/${drawId}/result/reject`);
    assert.equal(rej.json().pendingResult, null);
    assert.equal((await post(checker, `/v1/admin/draws/${drawId}/result`, { resultNumber: '222222' })).json().pendingResult, '222222');
  });

  test('ຍົກເລີກງວດ → ຄືນເງິນທຸກບິນ', async () => {
    const drawId = await openDraw(env, maker);
    const u = await makeUser(env, { balance: 50_000 });
    const t = (await buy(env, u, drawId, [{ number: '12', amount: 20_000 }])).json();
    assert.equal((await balanceOf(env, u.id)).balance, 30_000);
    const c = await post(maker, `/v1/admin/draws/${drawId}/cancel`, { reason: 'ລັດວິສາຫະກິດເລື່ອນງວດ' });
    assert.equal(c.json().status, 'cancelled');
    assert.equal((await balanceOf(env, u.id)).balance, 50_000);
    assert.equal((await env.app.inject({ method: 'GET', url: `/v1/tickets/${t.id}`, headers: u.headers })).json().status, 'cancelled');
    assert.equal((await post(maker, `/v1/admin/draws/${drawId}/cancel`, { reason: 'again' })).statusCode, 409);
  });

  test('ສິດ: auditor ອ່ານໄດ້ ແຕ່ແກ້ບໍ່ໄດ້; finance ສ້າງງວດບໍ່ໄດ້', async () => {
    const auditor = await makeUser(env, { role: 'auditor' });
    const fin = await makeUser(env, { role: 'finance' });
    assert.equal((await env.app.inject({ method: 'GET', url: '/v1/admin/draws', headers: auditor.headers })).statusCode, 200);
    assert.equal((await env.app.inject({ method: 'GET', url: '/v1/admin/dashboard', headers: auditor.headers })).statusCode, 200);
    assert.equal((await post(auditor, '/v1/admin/draws', {})).statusCode, 403);
    assert.equal((await post(fin, '/v1/admin/draws', {})).statusCode, 403);
    const cust = await makeUser(env);
    assert.equal((await env.app.inject({ method: 'GET', url: '/v1/admin/dashboard', headers: cust.headers })).statusCode, 403);
  });
});
